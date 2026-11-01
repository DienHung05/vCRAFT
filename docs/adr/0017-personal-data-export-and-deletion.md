# ADR-17 — Recorded consent, personal data export and self-service deletion

- Status: **Accepted** (1 Nov 2026)
- Related: NFR-SEC-07 (Vietnam Decree 13/2023/ND-CP), NFR-SEC-03, vCRAFT-83g.31, the audit log (FR-ADM-05), the production journal hash chain (vCRAFT-9hg.4)
- Needs legal review: the retention exceptions in "Deletion policy" below.

## Context

NFR-SEC-07 asks for a privacy policy, consent when ID documents are collected, and a way for people to download and delete their own data. The policy page and client-side consent boxes existed; nothing was recorded on the server, and export and deletion were "ask the Management Board". Deleting a person cannot simply delete rows: orders and quotations involve other parties, and the production journal is an append-only SHA-256 chain whose verification must keep passing.

## Decision

### Consent is a server-side fact

- Table `consent_record` (`user_id`, `purpose`, `policy_version`, `created_at`), append-only. Purposes: `SIGN_UP`, `ID_DOCUMENT`, `RFQ_CONTACT`, `MAKER_PROFILE`. The current policy version is `PRIVACY_POLICY_VERSION` in `@vcraft/domain`; bump it with the "last updated" line of the policy page when a change needs new consent.
- `POST /me/consents` records a consent (idempotent per user, purpose, version; an outdated version is a 422). `GET /me/consents` lists them.
- The API refuses with `CONSENT_REQUIRED` (403) when the current-version consent is missing: `POST /me/household` (`SIGN_UP`), `POST /media?purpose=CERTIFICATE` (`ID_DOCUMENT`), `POST /rfqs` (`RFQ_CONTACT`), `POST /me/household/artisans` (`MAKER_PROFILE`).
- The web records the consent when the person ticks the box and acts: before the first RFQ draft is saved, before the first document is uploaded, before a maker is added. `SIGN_UP` is carried in the Supabase user metadata (`privacy_policy_version`) set by the sign-up form and recorded by the auth guard when the account row is first created; an account without it is asked in the household wizard.
- Accepted limitation: the metadata is user-editable, so `SIGN_UP` is the person's own claim, recorded with the server's time. The other three are recorded by authenticated calls.

### Export

`GET /me/data-export` returns one JSON document (`DataExportSchema`): account, household (profile, workshops, makers, products with their journal), quotation requests, offers, allocations, notifications, email choices, consents, and every uploaded file with a link (signed, 5 minutes, for private files). Every query is scoped to the caller, and quotations are summarised without other households' parts or prices.

There is no field-level encrypted column in the schema yet (`FIELD_ENCRYPTION_KEYS` is configured but unused; NFR-SEC-03 is still to do). The export service documents that such values must be decrypted there, for the owner, when they exist.

### Deletion policy

`DELETE /me` with body `{ "confirmation": "<account email>" }`, from the account page behind a typed-confirmation dialog.

- **Blocked** (409) while the person has an order in progress: as buyer a request in `ACCEPTED` or `IN_PRODUCTION`; as household representative an allocation `PROPOSED`, `CONFIRMED` or `IN_PROGRESS` (`ACCOUNT_DELETION_ACTIVE_ORDERS`). The message points to finishing the order or asking the Management Board to cancel it (admin cancel), after which deletion works. Administrator accounts are not deleted by self-service (`ACCOUNT_DELETION_ADMIN`).
- **Deleted:** email and name (the `app_user` row stays as a tombstone `deleted-<id>@deleted.invalid`, status `DELETED`, so foreign keys hold); consents; notifications, notices and email choices; every uploaded file and `media_link` (rows and stored objects, identity papers included); a household's workshops, makers (artisans), news and profile text; buyer draft requests; queued emails and image jobs for those.
- **Cancelled:** buyer requests still `SENT` or `BIDDING` (submitted quotations withdrawn, invited households notified); the household's active offers on open requests (withdrawn, with the usual history entry).
- **Anonymized and kept:** the household row (renamed "Removed household", slug `removed-<id>`, `SUSPENDED`, so it leaves every public page), its products (withdrawn, personal text and images cleared), the delivery address of kept requests.
- **Kept untouched:** orders, quotations, allocations, offers, and the production journal with the public photos its entries reference (matched by SHA-256), so `verifyChain` still passes and the record stays checkable. These hold no personal data of the person once the above is done. Whether keeping them is covered by the legal-obligation / legitimate-interest exception of Decree 13 needs legal review.
- **Audit:** an `account.delete` entry (actor and entity are the account id; no email) is written in the same transaction. The audit screen shows no name for deleted actors.
- **Order of effects:** database changes and the Supabase Auth deletion (`auth.admin.deleteUser` with the secret key) run in one transaction; the auth call is last, so if Supabase refuses, nothing is committed and the person can retry. Stored files are removed after commit; a failure there is logged with asset ids and leaves only orphan objects (no row points to them).
- Tokens issued before deletion stop working at once: the auth guard answers 401 for a `DELETED` account. The worker skips mail to deleted accounts.

## Alternatives considered

| Option | Why not |
|---|---|
| Hard-delete everything, including orders and journal | Breaks other parties' records and the hash chain. |
| Soft-delete only (flag the account) | Keeps personal data, which is what the person asked us to remove. |
| Request-and-approve flow through the Management Board | Not self-service; blocks on a person. The Management Board is still the route for blocked cases. |
| Anonymize journal notes | Notes are inside the hashed chain; changing them breaks verification. |
| Consent only in the browser | Not evidence; this ADR makes it recorded and enforced. |

## Consequences

- New migration `consent_record` (both drivers); existing accounts have no consent until they act (they see the checkbox again). The demo seed records every consent for its sample accounts.
- `ObjectStorage` gains `delete`.
- Existing integration helpers create users with all consents by default; tests of the gates create users with `{ consent: false }`.
