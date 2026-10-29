# Private contributions and cooperative quotations

A contribution offer belongs to one quotation request. It declares the household's maximum quantity, VND unit price and completion date. It does not reserve capacity on other requests. The buyer receives complete quotations, with participant quantities and dates but without household unit prices.

All endpoints below use `/api/v1` and require the authenticated user's bearer token. Business data goes through the API. Supabase supplies authentication only.

## Request and invitations

1. A buyer creates a draft with `POST /rfqs`, using `CreateRfqRequestSchema`.
2. The buyer sends it with `POST /rfqs/:id/submit` and `If-Match` set to its current version. Sending checks email confirmation and requires a future quotation deadline, followed by required delivery.
3. An administrator claims an opted-in request with `POST /rfqs/:id/coordinate`. This also requires `If-Match`. A second administrator cannot take over that request.
4. The assigned administrator may invite additional approved households with `POST /rfqs/:id/invitations`, an `If-Match` header and `{ "householdIds": [...] }`.

Coordination consent permits administrative coordination. It does not invite every household. Representatives can access only requests addressed to their household. Requests return their version through the response body and `ETag` header.

## Contributions

Invited representatives use `POST /rfqs/:id/contributions` with:

```json
{
  "maxQuantity": 2000,
  "unitPriceVnd": 30000,
  "completionDate": "2027-02-01T00:00:00.000Z"
}
```

The completion date must follow the quotation deadline and be no later than required delivery. Quantities are positive whole numbers, at most 2,147,483,647. Unit prices are positive whole VND amounts.

`GET /rfqs/:id/contributions` returns the representative's own offer or all offers for the assigned coordinator. Buyers cannot read this endpoint. Representatives update their offer through `PUT /contributions/:id` or withdraw it through `POST /contributions/:id/withdraw`, with its current `If-Match` version. `GET /contributions/:id/history` retains previous versions for the representative and coordinator.

## Manual quotation

`GET /rfqs/:id/coordination` gives the assigned administrator the request and household contributions. `POST /rfqs/:id/quotations` takes `CreateCooperativeQuotationRequestSchema` and requires the current request version in `If-Match`.

Every selected part names a household, quantity, unchanged unit price, unchanged completion date and current contribution version. Selected quantities must total the request exactly and stay within the household offers. The server computes the production total and adds the explicit additional charge. `deliveryTerms` is `INCLUDED` or `SEPARATE`, so the buyer knows whether delivery requires a separate arrangement.

For 2,000 cups at 30,000 VND, 1,500 at 32,000 VND and 1,500 at 34,000 VND, the production total is 159,000,000 VND. The buyer sees the three shares and dates plus the full price. Individual contribution rates stay private.

`GET /rfqs/:id/quotations` returns the buyer projection to the owning buyer and the internal projection to the assigned administrator. Replacing a quotation preserves its previous record. A contribution revision or withdrawal withdraws dependent unaccepted quotations in the same transaction. It creates private notices for the buyer and coordinator, readable at `GET /me/quotation-notices`. The outbox also records the withdrawal for later delivery integrations.

Submission and changes stop at the quotation deadline. Reads report unaccepted open requests as `EXPIRED` and submitted quotations as `LAPSED` at that instant, even without an expiry worker. Accepted requests cannot change contributions through these endpoints.

## Web entry points

With an existing authenticated Supabase browser session, the UUID request ID selects the live views:

- `/vi/admin/dieu-phoi/:requestId` lets the assigned coordinator compose the manual quotation, or claim an unassigned request that opted into coordination.
- `/vi/studio/de-xuat-tham-gia/:requestId` lets an invited representative create, revise, withdraw or reactivate their contribution.
- `/vi/yeu-cau-bao-gia/:requestId` shows the owning buyer the complete quotations without internal household rates.

The live views poll every ten seconds while visible and refresh when the tab becomes visible. Sample `RFQ-*` URLs retain their explicit demo labels. They do not save server records.

## Client and verification

`createQuotationClient` from `@vcraft/api-client` accepts a `getAccessToken` callback. It validates request and response shapes, sends versions on writes and returns `QuotationApiError` codes for HTTP errors. A `STALE_VERSION` response requires a fresh read before another submission.

The domain entry point is `assembleCooperativeQuotation`. It checks the manual plan against current contributions. `projectBuyerQuotation` allowlists buyer-visible fields.

Run focused checks with:

```sh
pnpm --filter @vcraft/domain exec vitest run test/cooperative-quotation.test.ts
pnpm --filter @vcraft/contracts exec vitest run test/cooperative-quotation.test.ts
pnpm --filter @vcraft/api-client exec vitest run test/quotation.test.ts
pnpm --filter @vcraft/api exec vitest run --config vitest.integration.config.mts test/integration/cooperative-quotation.integration.test.ts
```

The integration test requires a container runtime. It creates disposable PostgreSQL or MySQL databases through Testcontainers. Use `DB_DRIVER=mysql` for the MySQL run. It never uses the shared Supabase database. Both drivers have migrations and schema snapshots in `packages/database/src/migrations/`.
