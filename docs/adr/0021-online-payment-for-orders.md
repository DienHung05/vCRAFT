# ADR-0021: Online payment for orders (SePay, VNPay, MoMo)

**Status:** Proposed (Release 2, sandbox only until the open questions below are answered)
**Date:** 2026-11-07
**Deciders:** Project owner, architecture team
**Tracks:** GH#164 (Beads `vCRAFT-83g.40`)

## Context

`PRODUCT.md` puts online payment out of scope for this version: buyers and households settle an
[Order](../../GLOSSARY.md) offline. Buyers have asked to pay a deposit online by bank transfer, VietQR,
VNPay or MoMo. Collecting money on behalf of households needs a merchant contract held by the village
administration and a legal check, neither of which exists yet.

Facts checked on 2026-11-01:

- **SePay payment gateway** (developer.sepay.vn, official Node SDK `sepay-pg-node`): one-time checkout by
  a signed form POST to `/v1/checkout/init`; `payment_method` `BANK_TRANSFER` (VietQR),
  `NAPAS_BANK_TRANSFER` (NAPAS dynamic QR) or `CARD` (Visa/Master/JCB 3DS); success/error/cancel URLs;
  IPN on status change; sandbox environment; `order.retrieve/all/cancel`.
- **SePay does not offer VNPay or MoMo.** Those need their own direct integrations.
- **SePay bank-account webhooks**: one POST per incoming transfer to a bank account linked to SePay; must
  answer `200 {"success":true}` within 30 s; the transfer content carries a payment code we generate.
  The cheapest path for "bank transfer" and "QR" on a student budget.
- **VNPay**: self-service sandbox merchant (sandbox.vnpayment.vn); maintained TypeScript library `vnpay`
  (lehuygiang28/vnpay, v2.5, 2026-04). Redirect plus IPN, HMAC-SHA512.
- **MoMo**: test environment with public test credentials (developers.momo.vn); `captureWallet` create →
  `payUrl` / deeplink / QR, IPN, HMAC-SHA256. Small surface: implement directly, the npm wrappers are thin
  and little used.

## Decision

Plan online payment of orders as a Release 2 feature that runs **in sandbox only** until the owner has a
merchant contract and the legal check is done. Nothing ships to production users before then, and
`PRODUCT.md` keeps online payment out of scope for the current version.

### The four methods

| Method | Provider | Flow |
|---|---|---|
| Bank transfer | SePay bank-account webhook | Show account, amount and a payment code; reconcile on the webhook |
| QR code | SePay (VietQR image for the same transfer) | Same reconciliation as bank transfer |
| VNPay | VNPay direct | Redirect to VNPay, mark paid from the IPN |
| MoMo | MoMo direct | `payUrl` / app deeplink / QR, mark paid from the IPN |

Card payment through the SePay gateway is possible later with the same port.

### Domain

- What is paid is an **Order** (an accepted quotation). Two **Payments** per order: a **Deposit**
  (configurable share, default 30 %) before allocations are confirmed and production starts, and the
  balance before delivery. Amounts are VND integers fixed when the order is made.
- New entity `payment`: `id`, `order_id`, `kind` (`DEPOSIT` | `BALANCE`), `method` (`BANK_TRANSFER` |
  `VIETQR` | `VNPAY` | `MOMO`), `provider` (`SEPAY` | `VNPAY` | `MOMO`), `amount_vnd`, `reference_code`
  (unique; goes into the transfer content, `vnp_TxnRef` or MoMo `orderId`), `provider_txn_id` (unique per
  provider, nullable), `status` (`PENDING` | `PAID` | `FAILED` | `EXPIRED` | `CANCELLED` | `REFUNDED`),
  `expires_at`, `paid_at`, `raw_last_event` (json), timestamps. Migrations for PostgreSQL and MySQL, with
  integration tests on both.
- A payment state machine in `packages/domain` (like the RFQ state machine): `PENDING` → `PAID` |
  `FAILED` | `EXPIRED` | `CANCELLED`; `PAID` → `REFUNDED` (administrator only, manual). The order derives
  `depositPaidAt` and `balancePaidAt` from its payments; order guards require a `PAID` deposit before
  production starts.
- Payouts to households stay offline: the village administration settles allocations; they are recorded,
  not automated.

### Architecture

```
packages/contracts   zod: CreatePaymentRequest, PaymentView, provider webhook payloads
packages/domain      payment-state-machine.ts, amount and deposit rules
apps/api/src/modules/payments/
  payments.controller.ts          POST /orders/:code/payments (buyer)   GET /payments/:ref (buyer, poll)
  payment-webhooks.controller.ts  POST /payments/webhooks/{sepay,vnpay,momo} (@Public, signature-checked)
  payment-return.controller.ts    GET /payments/return/{vnpay,momo} → redirect to the web status page
  payments.service.ts             create, reconcile(event) idempotently, expire
  gateways/  PaymentGateway port { createCheckout(payment); verifyWebhook(req); queryStatus(ref) }
             sepay.gateway.ts  vnpay.gateway.ts  momo.gateway.ts
apps/worker   expire stale PENDING payments; query provider status for PENDING older than N minutes
              (missed IPN); outbox → notifications (buyer, administration, households)
apps/web      order page: "Pay deposit" → method picker → QR/bank panel with live status (poll
              GET /payments/:ref every 3 s, stop on a final state) or redirect for VNPay/MoMo →
              /[locale]/thanh-toan/[ref] result page
```

### Rules

- A payment becomes `PAID` only from a verified webhook/IPN or a server-side status query, **never from
  the browser return URL**.
- Amount and reference must match exactly.
- Each provider event is handled idempotently (unique `provider_txn_id`, row lock on the payment).
- Webhooks answer fast; heavy work goes to the outbox.
- Every webhook hit is logged with its signature result.
- Secrets live only on Render (`SEPAY_WEBHOOK_API_KEY`, `SEPAY_MERCHANT_ID` / `SEPAY_MERCHANT_SECRET`,
  `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET`, `MOMO_PARTNER_CODE` / `MOMO_ACCESS_KEY` / `MOMO_SECRET_KEY`),
  never on Vercel. Webhook URLs go through the Vercel rewrite
  (`https://<domain>/api/v1/payments/webhooks/...`); the keep-alive cron already prevents Render cold
  starts.

### Slices (one PR each, test-first)

1. This ADR, plus `PRODUCT.md` and `GLOSSARY.md` (Payment, Deposit).
2. Domain, entity, migrations (PostgreSQL and MySQL), contracts.
3. SePay bank transfer and VietQR: create, webhook, expiry job, buyer UI with live status. Sandbox/demo
   mode with a "simulate transfer" administrator button, only when `APP_ENV != production`.
4. VNPay sandbox (library `vnpay`): create URL, IPN, return page.
5. MoMo sandbox: create, IPN, return page.
6. Administration: payments per order, manual mark-refunded, audit-log entries, notifications.
7. E2E: a Playwright happy path per method using sandbox and signed fake webhooks; env table in
   `docs/deploy.md`.

### Open questions for the owner

- The deposit share, and whether the balance is paid online at all.
- Whose bank account receives the money (the village administration's), and whether a merchant contract
  with VNPay, MoMo or the SePay gateway is realistic. Until then: sandbox only.

## Options considered

- **SePay gateway for everything.** Rejected: it does not cover VNPay or MoMo.
- **SePay bank-account webhooks only (bank transfer and VietQR).** Cheapest and needs no merchant
  contract, but leaves out the two wallets buyers asked for. Kept as slice 3, the first to build.
- **A payment aggregator covering all four.** Not found with a sandbox and pricing that fit a student
  project; revisit if the village signs a merchant contract.
- **Keep payment offline.** The status quo for this version.

## Consequences

- No production change until the open questions are answered; the current release stays offline-only.
- When built, the order flow gains a deposit gate before production starts, and the API gains public,
  signature-checked webhook routes that must stay fast and idempotent.
- Three new secret sets on Render, and sandbox credentials for CI e2e.
