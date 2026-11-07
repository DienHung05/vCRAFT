# OWASP Top 10 (2021) checklist

Evidence for PLAN E14 and ARCHITECTURE §8.2 (NFR-SEC): for each OWASP item, the controls vCraft relies on and the code or test that proves them. Paths are relative to the repository root. **Gap** marks something that is not covered yet.

Last reviewed: 3 Nov 2026 (issue #97).

## A01 Broken access control

| Control | Evidence |
| --- | --- |
| One global guard decides who may call every API route: `@Public()`, `@Roles(...)`, or any signed-in account. | `apps/api/src/common/auth/auth.guard.ts` |
| Every route is enumerated from decorator metadata and compared with a reviewed snapshot. Public routes are read-only except the reviewed QR scan counter, `/admin/*` is ADMIN-only, and `/me/*` is never public. | `apps/api/src/common/auth/route-inventory.ts`, `apps/api/src/common/auth/route-policy.test.ts` (+ `__snapshots__/`) |
| Over HTTP on a real app: 401 without a token on every non-public route, 403 for every role a route does not allow. | `apps/api/test/integration/route-policy.integration.test.ts` |
| Ownership is checked in the use cases, not only by role: a household reads and writes only its own records. Another household's resources answer 404, so their existence does not leak. | `apps/api/test/integration/studio-products.integration.test.ts`, `studio-profile.integration.test.ts`, `qr-labels.integration.test.ts` |
| Sealed offers: a household sees only its own contribution, and the price hint never reads other households' offers. | `apps/api/test/integration/cooperative-quotation.integration.test.ts`, `price-hint.integration.test.ts` |
| The web hides Studio, Admin and Buyer areas behind a server-side role check (403 page), not only links. | `apps/web/src/lib/auth/guard.ts`, `apps/web/test/auth-guard.test.ts` |
| Supabase: every business table has RLS on and `anon`/`authenticated` have no grants; only the backend reaches the data. | `supabase/migrations/20261027134915_business_db_guard.sql`, `apps/api/test/integration/supabase-guard.integration.test.ts` |
| Optimistic locking (`If-Match`) on every write that edits shared state, so stale writes fail with 409. | `apps/api/src/common/http/if-match.ts`, the 409 cases in `studio-profile.integration.test.ts` |

## A02 Cryptographic failures

| Control | Evidence |
| --- | --- |
| Citizen ID numbers are encrypted per field (AES-256-GCM, versioned keys, rotation CLI). The API shows them masked, and revealing one is an audited admin action. | `apps/api/src/infrastructure/crypto/crypto.module.ts`, `packages/database/src/crypto/`, `apps/api/test/integration/id-number-encryption.integration.test.ts` |
| HTTPS only in production, with HSTS for a year including subdomains. | `apps/web/src/lib/deploy-config.ts`, `tests/e2e/specs/public/security-headers.spec.ts` |
| Private files (documents, originals, QR sheets) sit in a private bucket and are served only through presigned URLs that expire after 5 minutes. | `packages/storage/src/object-storage.ts` (`PRESIGN_TTL_SECONDS`), `apps/api/src/modules/media/application/media.service.ts` |
| Passwords are handled by Supabase Auth only; the API never sees or stores them. | `apps/api/src/common/auth/identity-verifier.ts` |

## A03 Injection

| Control | Evidence |
| --- | --- |
| Every request body and query is parsed with Zod schemas from `@vcraft/contracts` before reaching a use case. Unknown or malformed input gets 422. | `apps/api/src/common/pipes/zod-validation.pipe.ts`, `packages/contracts/src/` |
| Data access goes through MikroORM with bound parameters; search terms are reduced to `[a-z0-9]` before `LIKE`. | `packages/utils/src/slug.ts` (`searchTerms`), `apps/api/src/modules/catalog/application/catalog.service.ts` |
| News rich text is sanitised on the server before it is stored (allowlisted tags and attributes). | `apps/api/src/modules/news/application/sanitize-news.ts`, `apps/api/test/integration/admin-news.integration.test.ts` |
| Path parameters that name records are UUID-validated. | `apps/api/src/common/pipes/uuid.pipe.ts` |

## A04 Insecure design

| Control | Evidence |
| --- | --- |
| Business rules live in pure domain state machines with guards (quotation, bid, allocation, household), tested without a database. | `packages/domain/src/rfq/`, `packages/domain/test/*state-machine.test.ts` |
| Production journals are append-only and SHA-256 hash-chained, so tampering is detectable. | `packages/domain/src/journal/`, `apps/api/test/integration/journal-integrity.integration.test.ts` |
| Consent to the privacy policy is recorded per purpose and version before personal data is processed. | `packages/domain/src/privacy/`, `apps/api/test/integration/privacy.integration.test.ts` |
| **Gap:** no rate limiting on the API (sign-in is rate-limited by Supabase Auth). Planned with the assistant guardrails (#80) and Turnstile (#84). | |

## A05 Security misconfiguration

| Control | Evidence |
| --- | --- |
| Security headers on every page: HSTS, `nosniff`, a strict referrer policy, a permissions policy, and a CSP with a per-request `script-src` nonce and `'strict-dynamic'` (no `'unsafe-inline'` for scripts), plus `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`. Checked on the running web app. | `apps/web/src/lib/csp.ts`, `apps/web/src/proxy.ts`, `apps/web/test/csp.test.ts`, `apps/web/src/lib/deploy-config.ts`, `apps/web/test/deploy-config.test.ts`, `tests/e2e/specs/public/security-headers.spec.ts` |
| No `X-Powered-By` header (turned off in #97). | `apps/web/next.config.ts`, `tests/e2e/specs/public/security-headers.spec.ts` |
| Errors are returned as RFC 9457 problem details without stack traces. | `apps/api/src/common/filters/problem-details.filter.ts` and its test |
| Signed-in and private responses are sent `Cache-Control: private, no-store`; public catalogue responses use a short public cache. | `apps/api/src/common/http/public-cache.ts`, `@Header('Cache-Control', 'private, no-store')` in the controllers |
| **Gap:** `style-src` still allows `'unsafe-inline'` because React and MapLibre write `style` attributes, which a nonce cannot cover. Scripts are nonce-only. | |

## A06 Vulnerable and outdated components

| Control | Evidence |
| --- | --- |
| pnpm runs no install scripts except an explicit allowlist, and the lockfile is checked against pnpm's supply-chain policies on install. | `pnpm-workspace.yaml` (`allowBuilds`) |
| Frozen lockfile in CI and deploy builds. | `.github/workflows/ci.yml`, `render.yaml` |
| **Gap:** no scheduled dependency audit (e.g. `pnpm audit` or OSV) in CI yet. | |

## A07 Identification and authentication failures

| Control | Evidence |
| --- | --- |
| Supabase Auth issues the sessions; the API verifies every JWT with Supabase (signature, expiry) and maps it to an `AppUser`. A new account always starts as BUYER, and roles cannot be self-assigned. | `apps/api/src/common/auth/identity-verifier.ts`, `auth.guard.ts`, `apps/api/test/integration/supabase-guard.integration.test.ts` |
| Changing a password re-checks the current one and signs out other devices. | `apps/web/test/account-forms.test.tsx` |
| Public pages set no session cookie; cookies are `SameSite=Lax`, path `/`, and `Secure` on HTTPS. | `tests/e2e/specs/public/security-headers.spec.ts` |
| Locked household accounts can read but not write. | `HOUSEHOLD_ACCOUNT_LOCKED` in `apps/api/src/modules/households/application/households.service.ts` |
| **Gap:** MFA for admins (#83) and CAPTCHA on auth forms (#84) are open issues. | |

## A08 Software and data integrity failures

| Control | Evidence |
| --- | --- |
| Uploads are typed by magic bytes, never by the client's `Content-Type`; size and bucket rules are in the domain. | `packages/domain/src/media/upload-policy.ts`, `packages/domain/test/media.test.ts`, `apps/api/test/integration/media-pipeline.integration.test.ts` |
| Background work goes through a transactional outbox, so a job is queued only if the business change committed, and jobs are idempotent. | `packages/database/src/repositories/outbox.repository.ts`, `apps/api/test/integration/outbox-*.integration.test.ts` |
| Journal hash chain (see A04). | |

## A09 Security logging and monitoring failures

| Control | Evidence |
| --- | --- |
| Admin decisions and sensitive reads (revealing a citizen ID) go to an audit log with actor, entity and before/after, viewable by admins. | `apps/api/src/modules/admin/application/audit-log.service.ts`, `apps/api/test/integration/admin-approval.integration.test.ts` |
| Health and readiness endpoints for uptime monitoring. | `apps/api/src/modules/health/` |
| **Gap:** no alerting on repeated 401/403 bursts. | |

## A10 Server-side request forgery

| Control | Evidence |
| --- | --- |
| The API never fetches a URL a user supplies. Gallery images are either the household's own uploads (by media id) or demo images matched against a fixed local path pattern. | `GalleryInputSchema` in `packages/contracts/src/households/index.ts`, the external-URL 422 case in `apps/api/test/integration/studio-profile.integration.test.ts` |
| Outbound calls go only to configured services (Supabase, SMTP, the exchange rate source), all set by environment variables. | `.env.example` |
