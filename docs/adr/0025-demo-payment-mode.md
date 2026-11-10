# ADR-0025: Demo payment mode for the live site

**Status:** Accepted 2026-11-10 (owner decision for the project defense and the live demo). Complements [ADR-0021](0021-online-payment-for-orders.md) and [ADR-0024](0024-payment-gateways-in-production.md).
**Date:** 2026-11-10
**Deciders:** Project owner
**Tracks:** GH#205

## Context

The live site runs with `APP_ENV=production` and holds no payment credential: no SePay account, no VNPay or MoMo
merchant. For the defense the owner wants the full buyer journey to be shown anyway: pick bank transfer, VNPay or
MoMo, see a QR, scan it with a phone, confirm, and watch the desktop page flip to "paid". ADR-0024 forbids a
sandbox gateway under `APP_ENV=production` (fake money on a live site), and without credentials no gateway is
offered at all, so the journey cannot be shown today.

## Decision

1. **A separate, explicit flag.** `PAYMENTS_DEMO_MODE=true` turns on demo payment mode. Unlike a sandbox gateway,
   it is allowed under `APP_ENV=production`: it is its own flag, it is off by default, and every screen of it says
   "Thanh toán thử — không trừ tiền thật" / "Chế độ demo: không có giao dịch tiền thật".
2. **What it does.** All three methods are offered whatever credentials exist, every method is flagged as a test
   method, the amount limits and the order rules are unchanged, and every payment expires after the wallet time
   (`PAYMENT_WALLET_EXPIRES_IN_MINUTES`). Creating a payment uses the `DemoGateway` and never a real gateway, even
   one that is configured. It makes no outbound call. The status query and the provider sweep skip demo payments.
3. **The QR is our own link, never a bank QR.** A real banking app that scanned an invented VietQR could send real
   money to an account that is not ours. The checkout is `{ type: 'DEMO', confirmUrl }`, with
   `confirmUrl = <APP_URL>/vi/thanh-toan/thu/<code>?k=<secret>`; the secret is 24 random bytes (base64url), stored
   only inside the payment's checkout JSON (no migration). The web draws the QR in the browser from that link.
   Demo mode never produces a `qrPayload` or a SePay QR image URL.
4. **The confirm page and its API.** `GET /payments/demo/{code}?k=` returns only the code, amount, method, kind,
   status and expiry (no buyer or order data); `POST /payments/demo/{code}/confirm` takes the secret and an outcome
   (`PAID` or `FAILED`). Both are public and answer 404 unless demo mode is on, the payment exists, its checkout is a
   demo one and the secret matches (constant-time comparison). Confirming goes through the normal
   `PaymentsService.reconcile` with provider transaction id `DEMO-<code>`, so the order, the notices, the deposit
   state and idempotency behave as for a real payment, and the row's `raw_last_event` holds `{ "demo": true }`. A payment
   that is no longer pending, or has run out of time, just answers its current state. Each hit is logged with the
   code and the outcome, never the secret. No audit-log row is written, as it needs a signed-in actor.
5. **The deposit gate defaults to off in demo mode.** Otherwise a half-configured demo would block production
   start for an order. An explicit `PAYMENTS_DEPOSIT_REQUIRED` still wins.
6. **Anyone holding the QR or link can confirm.** Accepted: no money moves, and the secret is per payment.
7. **It must be switched off before real money.** Unset `PAYMENTS_DEMO_MODE` before any real method goes live
   (ADR-0024 checklist). The boot log says `online payment is in DEMO mode` and warns while it is on; confirm links
   then answer 404 and pending demo payments expire.

## Options considered

- **Run VNPay and MoMo in sandbox on the live site.** Rejected: ADR-0024 refuses it on purpose, and it still
  needs sandbox credentials and the providers' pages, which the defense cannot depend on.
- **A VietQR of a made-up account.** Rejected: a real bank app could move real money.
- **Confirm from the desktop only.** Rejected: the defense wants the phone scan.
- **Reuse the admin "simulate transfer".** Rejected: it is an administrator action, bank transfer only, and off in production.

## Consequences

- The journey can be shown on the live site with no merchant account; the orders and notices it produces are real
  rows, marked as demo payments on `raw_last_event`.
- Payments created in demo mode are not real revenue. After the defense, switch the flag off and refund nothing.
- A leaked confirm link settles one rehearsal payment and nothing else.
