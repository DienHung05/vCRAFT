# ADR-0024: VNPay and MoMo ready for production, with a provider status query

**Status:** Accepted 2026-11-09. Amends [ADR-0021](0021-online-payment-for-orders.md), whose "sandbox only" decision for VNPay and MoMo no longer holds.
**Date:** 2026-11-09
**Deciders:** Project owner, architecture team
**Tracks:** GH#205, Beads `vCRAFT-83g.55`

## Context

ADR-0021 built bank transfer (SePay), VNPay and MoMo, with the two wallets behind one flag
(`PAYMENTS_SANDBOX_GATEWAYS`) that had to stay off in production. To take real money the wallets need three
things the sandbox build did not have:

- a way to run against production endpoints without any chance of mixing sandbox and real money;
- a safety net for the IPN (the provider's server-to-server notice) that never arrives, which ADR-0021 listed
  under "Not built": a buyer who paid sees "pending" until the payment expires;
- limits and timings that match what the providers accept.

Facts, verified on 2026-11-11 against the providers' official documentation and samples:

- **VNPay v2.1.0.** The `querydr` fields, checksums and status codes come from the sandbox.vnpayment.vn
  documentation. The amount range, 5,000 VND up to (not including) 1,000,000,000 VND, comes from VNPay's
  official error page (`pay.vnpay.vn/Payment/Error.html?code=32`), i.e. 5,000 to 999,999,999 VND. VNPay's
  production host is `pay.vnpay.vn`, but the exact payment page and merchant API URLs are still handed over at
  merchant onboarding and are taken from the environment. The IPN URL is registered in the VNPay merchant
  portal, not sent per request. `querydr` (POST JSON to the merchant API) returns the state of a transaction,
  signed with HMAC-SHA512 over fields joined by `|`. `vnp_ExpireDate` is required.
- **MoMo v2.** The production endpoints come from the merchant contract (onboarding mail). Sources:
  developers.momo.vn (result-code list and one-time payment page) and MoMo's official sample code
  (github.com/momo-wallet/payment, `php/atm/query_transaction.php`). `/v2/gateway/api/query` returns the
  `resultCode` of an order; its signature is HMAC-SHA256 over `accessKey=&orderId=&partnerCode=&requestId=`,
  which matches the official sample. The create and IPN signatures also come from the official sample.
  `resultCode` `0` is success. `9000` is "transaction is authorized successfully": for a 1-step payment MoMo
  says to mark it as success (a 2-step payment needs a later capture or cancel); we always create with
  `autoCapture: true` (1-step), so `9000` is paid. `1000` (initiated, awaiting the buyer), `7000` (being
  processed) and `7002` (being processed by the payment instrument's provider) are not final. `1001`
  (insufficient funds), `1004` (exceeds the limit), `1005` (URL or QR expired) and `1006` (buyer denied) are
  failures, as are the other listed final codes (`1002`, `1003`, `1007`, `1017`, `1026`). `captureWallet`
  amounts are 1,000 to 50,000,000 VND (one-time payment page).

## Decision

1. **One mode per gateway.** `VNPAY_MODE` and `MOMO_MODE` take `off`, `sandbox` or `production`. Unset means
   `sandbox` when the legacy `PAYMENTS_SANDBOX_GATEWAYS=true`, else `off`; an unknown value means `off`.
   - `sandbox` uses the public sandbox URLs unless overridden.
   - `production` takes the credentials **and the URLs from the environment** (`VNPAY_PAY_URL`,
     `VNPAY_API_URL`, `MOMO_ENDPOINT`, optional `MOMO_QUERY_ENDPOINT`, default derived from the create endpoint).
     The code never guesses a production URL. All URLs, and `APP_URL`, must be `https`.
   - A gateway in `sandbox` mode is **never offered when `APP_ENV=production`**: fake money on a live site.
   - A gateway that cannot work is not offered; the reason goes to the boot log
     (`paymentsConfigIssues`, never with secret values).
2. **Provider status query in the API.** `PaymentGateway.queryStatus` asks VNPay (`querydr`) or MoMo (`query`)
   what became of a payment. A paid or failed answer goes through the same `PaymentsService.reconcile` as an
   IPN, with the same provider transaction id, so the two stay idempotent. The query runs: when the buyer
   returns with a valid signature (waits up to 4 s, then redirects); when the buyer's status page polls a
   pending payment older than 30 s (not awaited); and in a sweep every 120 s over payments still pending or
   expired within the last hour. At most one query per payment every 20 s. VNPay's answer must pass its
   checksum; MoMo's is trusted over TLS from the configured endpoint and must name our order and partner.
   Anything else is "no information" and changes nothing.
   It lives in the API, not the worker, because only the API holds the gateway secrets and the free plan runs
   one container; the worker's `payment.expire-sweep` is unchanged.
3. **Timing.** Wallet payments expire after `PAYMENT_WALLET_EXPIRES_IN_MINUTES` (default 30); bank transfer
   keeps `PAYMENT_EXPIRES_IN_HOURS`. Money that arrives for a payment expired within the last 60 minutes still
   settles it (late money, ADR-0021); a failure reported for an expired payment changes nothing.
4. **Amount limits.** `PAYMENT_AMOUNT_OUT_OF_RANGE` (409) when the amount is outside the method's limits:
   SePay at least 1 VND; VNPay 5,000 to 999,999,999 (`VNPAY_MAX_AMOUNT_VND`); MoMo 1,000 to 50,000,000
   (`MOMO_MAX_AMOUNT_VND`). The order summary lists each method's limits and whether it is sandbox
   (`methodOptions`), so the web can disable a method and label a test gateway.
5. **MoMo result codes.** A callback or query with `1000`, `7000` or `7002` leaves the payment pending (it
   used to fail it). `9000` (authorized) counts as paid, because our flow is 1-step (`autoCapture: true`); it
   settles the payment exactly like `0`. Only the listed final codes fail it.
6. **VNPay IPN replies.** A failure notice for a payment that is already settled answers `02` ("already
   confirmed") instead of `00`. A callback signed for another `vnp_TmnCode` is rejected.
7. **Refunds stay manual.** No gateway refund call. The administrator refunds from the provider's merchant
   portal (or the bank), then marks the payment refunded with a reason (ADR-0021).

## Options considered

- **Query from the worker.** Rejected: it would need the gateway secrets on a second service and a second
  copy of the signing code.
- **Query only from the buyer's poll.** Rejected: a buyer who closes the tab never triggers it. The sweep
  covers that.
- **Guess the production URLs.** Rejected: VNPay does not publish them, and a wrong guess could send real
  buyers to a sandbox page.
- **One global production flag.** Rejected: the village may sign with one wallet before the other.

## Consequences

- The code is ready for real money; **switching a method on still needs the owner's merchant contract and the
  legal check.** The environment decides: with `VNPAY_MODE` and `MOMO_MODE` unset (or `off`) nothing changes in
  production. `docs/operations/deploy.md` has the go-live checklist per method.
- A provider that is down only delays the sweep; the buyer's payment is never failed because a query failed.
- More outbound calls to the providers (bounded by the 20 s throttle and the batch of 25 per sweep).
- The query signature, the `resultCode` list and the amount limits were verified on 2026-11-11 (Context), so
  they are no longer a go-live check; the production URLs and keys still come from the provider's onboarding.
  `MOMO_MAX_AMOUNT_VND` and `VNPAY_MAX_AMOUNT_VND` can override the upper limits.
- Mixing sandbox credentials into a live deployment is caught at boot instead of by a buyer.
