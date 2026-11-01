# ADR-18 — Field-level AES-256-GCM encryption of the citizen ID number

- Status: **Accepted** (1 Nov 2026)
- Related: NFR-SEC-03, NFR-SEC-06, FR-ADM-02, [ADR-14](0014-object-storage-supabase.md), [ADR-17](0017-personal-data-export-and-deletion.md), vCRAFT-83g.33

## Context

NFR-SEC-03 asks for sensitive data (the citizen ID number, identity documents) to be encrypted at field level with AES-256-GCM and for key rotation to work. `FIELD_ENCRYPTION_KEYS` was configured but no column used it, and the privacy policy already said ID numbers are encrypted. Identity document files were already in the private bucket with 5-minute signed links; the number itself was not collected.

## Decision

- **Cipher** (`packages/database/src/crypto/field-cipher.ts`, class `FieldCipher`): AES-256-GCM, a random 96-bit IV per value, 128-bit auth tag. Stored text is `<keyId>:<iv>:<tag>:<ciphertext>`, the last three base64url. The field's context string (`household.id_number`) is authenticated as AAD, so a value copied into another field does not open.
- **Keys**: `FIELD_ENCRYPTION_KEYS=<keyId>:<base64 32 bytes>[,<keyId>:<base64>...]`. The first key encrypts, every key decrypts, and `keyId` in the stored value says which one sealed it. API (`CryptoModule`) and worker build the cipher while they start, so a missing or malformed list stops the deploy. Errors never contain key or value material.
- **Rotation**: put the new key first, keep the old one after it, deploy, run `pnpm db:rotate-field-keys` (re-seals every encrypted column in one transaction; a second run reports `rotated: 0`), then drop the old key. New encrypted columns must be added to `rotateFieldEncryption` and to the owner's data export.
- **Where it applies**: `household.id_number_enc` (varchar 255, nullable). Explicit service-level encrypt and decrypt, not an ORM type: the plaintext never sits on an entity, and loading households for public pages never decrypts anything.
- **Who sees the number**:
  - Collected in the household application wizard (12 digits, validated by `IdNumberSchema`), and addable or replaceable later with `PUT /me/household/id-number`.
  - The owner sees it masked (`••••••••1234`, in `GET /me/household` and Studio) and in full in their own `GET /me/data-export`.
  - An administrator sees it masked on `GET /admin/households/:id` and in full only through `GET /admin/households/:id/id-number`, which writes a `household.reveal_id_number` audit entry (actor and household, never the number).
  - No public, buyer or other-household endpoint returns it, masked or not.
  - Account deletion sets the column to null.
- **Logs and audit** (NFR-SEC-06): the number is only handled inside those services. Validation errors do not echo input, decryption failures carry no cause, and audit `before/after` never receive it. An integration test captures logger and stdout/stderr output and the audit table and asserts the plaintext is absent.
- **Documents**: unchanged and confirmed. `CERTIFICATE` uploads are `PRIVATE`, the Supabase bucket `vcraft-private` is not public, reads go through `presignGet` with `PRESIGN_TTL_SECONDS = 300`, and only the owner or an admin can request a link.

## Alternatives considered

| Option | Why not |
|---|---|
| MikroORM custom type decrypting on load | Needs a process-wide cipher, decrypts on every household load including public pages, and leaves plaintext on entities. |
| Database-level encryption (pgcrypto, MySQL AES_ENCRYPT) | Differs between PostgreSQL and MySQL and puts the key in SQL. |
| Store the last four digits in plaintext for the mask | Leaks part of the number in the raw table; the mask is computed after decrypting instead. |
| Hash instead of encrypt | The Management Board must be able to read the number to verify the application. |

## Consequences

- `FIELD_ENCRYPTION_KEYS` is now required to start API and worker and to seed demo data (CI sets a throwaway one; `.env.example` explains it). Losing every key loses the numbers.
- Households that applied before this change have no number until the representative adds it in Studio.
- Migration `household_id_number` (both drivers). The demo seed gives every sample household an obviously fake number (eight zeros plus the household number), encrypted like a real one.
