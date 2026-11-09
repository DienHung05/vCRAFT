# Private contributions and cooperative quotations

A contribution offer belongs to one quotation request. It declares the household's maximum quantity, VND unit price and completion date. It does not reserve capacity on other requests. The buyer receives complete quotations, with participant quantities and dates but without household unit prices. A household that quotes alone on a request without coordination (see "Direct household quotation") shows the buyer its own unit price.

All endpoints below use `/api/v1` and require the authenticated user's bearer token. Business data goes through the API. Supabase supplies authentication only.

## Request and invitations

1. A buyer creates a draft with `POST /rfqs`, using `CreateRfqRequestSchema`.
2. The buyer sends it with `POST /rfqs/:id/submit` and `If-Match` set to its current version. Sending checks email confirmation and requires a future quotation deadline, followed by required delivery.
3. An administrator claims an opted-in request with `POST /rfqs/:id/coordinate`. This also requires `If-Match`. A second administrator cannot take over that request.
4. The assigned administrator may invite additional approved households with `POST /rfqs/:id/invitations`, an `If-Match` header and `{ "householdIds": [...] }`.

Coordination consent permits administrative coordination. It does not invite every household. Representatives can access only requests addressed to their household. Requests return their version through the response body and `ETag` header.

### Retrying a state-changing call (`Idempotency-Key`)

Every `POST` in the endpoints below accepts an optional `Idempotency-Key` header (BR-L5): 1 to 255 printable ASCII characters, any other value answers 422 `VALIDATION_FAILED`. The web client sends a fresh UUID with create, submit, accept, cancel and receive. Without the header a call behaves as before.

- The key is scoped to the caller and the route (method and path, with the ids). The first call runs and its 2xx response (status and body) is stored; errors are not stored, so the same key can be retried after a failure.
- The same key with the same body from the same caller replays the stored response without running anything again, and adds `Idempotent-Replayed: true`. Two `POST /rfqs` with one key create one request.
- The same key with a different body answers 422 `IDEMPOTENCY_KEY_REUSED`. A repeat that arrives while the first call is still running answers 409 `IDEMPOTENCY_IN_PROGRESS`; retry it.
- Keys are kept for 24 hours (table `idempotency_keys`); the worker purges older rows every hour.

### Custom requirements and attachments

`CreateRfqRequestSchema` also takes `customRequirements` (text, at most 1,000 characters, for example logo printing) and `attachments` (at most three media IDs, for example a logo or a drawing). Attachments are the buyer's own uploads made with `POST /media?purpose=RFQ_ATTACHMENT`: images or PDFs in the private bucket, linked to the request as `media_link` rows of target `RFQ`. A buyer may upload that purpose only. The buyer, the administrators and, once the request is sent, the invited households can read an attachment through `GET /media/:id/read-url`; nobody else can.

### Request for an off-platform customer (FR-ORD-10)

An administrator may call `POST /rfqs` and `POST /rfqs/:id/submit` for a customer who orders by phone and has no account. The body then carries a required `onBehalfOf` object (`name` up to 120 characters, `phone` a Vietnamese mobile or landline number, optional `email`); a buyer who sends it gets 422. The administrator becomes the buyer of record and the coordinator (`coordinationOptIn` is forced to true), no privacy consent is recorded for the customer, and the buyer-only steps (`POST /rfqs/:id/accept`, receive, cancel before acceptance, rating) are done by that administrator. `onBehalfOf` is returned only to administrators and the coordination queue shows it; households and buyers never see it. Another administrator gets 404 for the buyer-only steps.

### Rating households (FR-ORD-11)

After a request is `DELIVERED` its owner calls `PUT /rfqs/:id/ratings/:householdId` with `{ "stars": 1-5, "comment"?: up to 1,000 characters }` for a household that finished a share of the order. One rating exists per request and household; calling again replaces it, until 30 days after it was first given (`BUSINESS_RULE_VIOLATED`, detail `RATING_WINDOW_CLOSED`, afterwards). Before delivery the call answers 409 `INVALID_TRANSITION`; a household with no finished share answers 404. The owner's `GET /rfqs/:id` lists the ratings. Households and public pages expose only `ratingAverage` (one decimal) and `ratingCount`; comments stay private.

### Matching households

A request sent with no invited household and no coordination request is matched at `POST /rfqs/:id/submit` (BR-05). The category is then required. The system invites up to ten households that are APPROVED, whose representative is not locked and that work in the request's category: they declared capacity for it, or sell a published product in it. A declared capacity of zero opts a household out. The best fit comes first: declared capacity, then published products in the category, then the buyers' average rating (a household with no rating ranks last among equals). The model has no response-rate or "accepting orders" data, so BR-05's score is these three. The response lists the matched households in `invitedHouseholdIds`, and the buyer sees "Đã gửi tới N hộ phù hợp". When no household matches, the submit fails with `RFQ_NO_MATCHING_HOUSEHOLD` and the request stays a draft.

### Order notices and reallocation

Accepting a quotation sends `ALLOCATION_PROPOSED` to the participating households, `QUOTATION_ACCEPTED` to the coordinator, and `RFQ_NOT_SELECTED` to all other invited households. The last notice reveals only that another offer was selected, without its price or participants. When the coordinator confirms receipt, `ORDER_RECEIVED` also reaches the buyer. The actor never receives their own notice.

Reallocating unfinished work during production sends `ALLOCATION_REASSIGNED` to the source household and `ALLOCATION_INCREASED` to each household receiving additional work, including a household newly added to the order. Those target allocations are already `IN_PROGRESS`, so their notice directs them to review their updated share without asking for confirmation. Reallocating a declined share before production still sends `ALLOCATION_PROPOSED`, because the recipients must confirm their proposed allocations.

Notices and mail outbox events commit in the same transaction as the order change. Failed changes leave no notices. An `Idempotency-Key` replay returns the original response without adding notices. The worker respects each recipient's email preference; disabling mail keeps the in-app notice and its link to the recipient's request screen.

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

## Direct household quotation

On a request without coordination nobody assembles a quotation, so an invited household quotes the whole quantity itself (FR-RFQ-04). It reuses the quotation entity with `bidType` `INDIVIDUAL`: one part for that household, no additional charge, delivery terms `SEPARATE`.

- `POST /rfqs/:id/direct-quotations` with `{ "unitPriceVnd": 30000, "completionDate": "...", "note": "..." }` submits it. The first one moves the request from SENT to BIDDING. A household has at most one active quotation per request (BR-L3): a second one answers `RFQ_BID_ALREADY_EXISTS`.
- `PUT /direct-quotations/:id` revises it in place (BR-L4: only while the request is open) and `POST /direct-quotations/:id/withdraw` withdraws it; both take `If-Match` with the quotation version. After a withdrawal the household may submit a new one.
- `GET /rfqs/:id/direct-quotations` returns the household's own quotations, newest first; `GET /me/invitations` carries the latest as `directQuotation`.

A household that was not invited gets 404. A coordinated request answers `RFQ_DIRECT_QUOTATION_NOT_ALLOWED`: its households send contributions instead. The completion window is the one of contributions.

The buyer reads these quotations in `GET /rfqs/:id/quotations` next to any other, with the household name, unit price, total, completion date and note, and accepts one with `POST /rfqs/:id/accept`. The others become REJECTED. Acceptance creates one PROPOSED allocation for the household, which confirms it, starts production by itself (T4, one-household order), reports progress and waits for the buyer's receipt like any one-part order. Because nobody coordinates such a request, a decline of the allocation notifies every active administrator, and any administrator may cancel the accepted order (T7). The buyer is notified of a new, revised or withdrawn quotation with the existing `QUOTATION_RECEIVED` and `QUOTATION_WITHDRAWN` notices.

## Manual quotation

`GET /rfqs/:id/coordination` gives the assigned administrator the request and household contributions. `POST /rfqs/:id/quotations` takes `CreateCooperativeQuotationRequestSchema` and requires the current request version in `If-Match`.

Every selected part names a household, quantity, unchanged unit price, unchanged completion date and current contribution version. Selected quantities must total the request exactly and stay within the household offers. The server computes the production total and adds the explicit additional charge. `deliveryTerms` is `INCLUDED` or `SEPARATE`, so the buyer knows whether delivery requires a separate arrangement.

For 2,000 cups at 30,000 VND, 1,500 at 32,000 VND and 1,500 at 34,000 VND, the production total is 159,000,000 VND. The buyer sees the three shares and dates plus the full price. Individual contribution rates stay private.

`GET /rfqs/:id/quotations` returns the buyer projection to the owning buyer and the internal projection to the assigned administrator. Replacing a quotation preserves its previous record. A contribution revision or withdrawal withdraws dependent unaccepted quotations in the same transaction. It creates private notices for the buyer and coordinator, readable at `GET /me/quotation-notices`. The outbox also records the withdrawal for later delivery integrations.

Submission and changes stop at the quotation deadline. Reads report unaccepted open requests as `EXPIRED` and submitted quotations as `LAPSED` at that instant, even without an expiry worker. Accepted requests cannot change contributions through these endpoints.

## Web entry points

With an existing authenticated Supabase browser session, the UUID request ID selects the live views:

- `/vi/admin/dieu-phoi` lists requests that opted into coordination, with one claim per request.
- `/vi/admin/dieu-phoi/:requestId` lets the assigned coordinator compose the manual quotation, or claim an unassigned request that opted into coordination.
- `/vi/studio/bao-gia` lists a household's invitations, and `/vi/studio/don-hang` its shares of accepted orders, with confirm, decline and progress reports.
- `/vi/studio/de-xuat-tham-gia/:requestId` lets an invited representative create, revise, withdraw or reactivate their contribution, or, on a request without coordination, send, revise or withdraw a quotation ("Gửi báo giá").
- `/vi/yeu-cau-bao-gia` lists the buyer's requests, and `/vi/yeu-cau-bao-gia/moi` creates one. Drafts save automatically through `PUT /rfqs/:id`.
- `/vi/yeu-cau-bao-gia/:requestId` shows the owning buyer the complete quotations without internal household rates, with accept, cancel and confirm receipt.

The live views poll every ten seconds while visible and refresh when the tab becomes visible.

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
