import { createHmac } from 'node:crypto';
import { LockMode } from '@mikro-orm/core';
import {
  OrderPaymentsResponseSchema,
  type PaymentDto,
  PaymentResponseSchema,
} from '@vcraft/contracts';
import { expireDuePayments, Payment, QuotationRequest, resolveDbDriver } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PAYMENT_HTTP,
  type PaymentHttp,
} from '../../src/modules/payments/gateways/payment-gateway.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const SEPAY_KEY = 'sepay-integration-key';
const ACCOUNT = '0123456789';
const VNPAY_SECRET = 'vnpay-integration-secret';
const MOMO = { partner: 'MOMOTEST', access: 'access-key', secret: 'secret-key' };

/** Stands in for MoMo's create endpoint: no request ever leaves the process. */
const momoRequests: Array<Record<string, unknown>> = [];
/** Lets a test hold the MoMo call open (`gate`), see it start (`entered`) or make it fail (`fail`). */
const momoControl: { gate?: Promise<void>; entered?: () => void; fail?: boolean } = {};
const fakeMomoHttp: PaymentHttp = async (_url, init) => {
  const body = JSON.parse(init.body) as Record<string, unknown>;
  momoRequests.push(body);
  momoControl.entered?.();
  await momoControl.gate;
  if (momoControl.fail) throw new Error('MoMo is down');
  return {
    ok: true,
    status: 200,
    json: async () => ({
      resultCode: 0,
      payUrl: `https://test-payment.momo.vn/pay/${body.orderId}`,
      deeplink: 'momo://pay',
      qrCodeUrl: null,
    }),
  };
};

describe('online payment of orders (ADR-0021)', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { id: string; auth: string };
  let stranger: { auth: string };
  let admin: { id: string; auth: string };
  let rep: { auth: string; householdId: string };
  const deadline = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const completionDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const requiredBy = new Date(Date.now() + 20 * 86_400_000).toISOString();

  beforeAll(async () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('APP_URL', 'https://vcraft.test');
    vi.stubEnv('SEPAY_WEBHOOK_API_KEY', SEPAY_KEY);
    vi.stubEnv('SEPAY_BANK_NAME', 'MB Bank');
    vi.stubEnv('SEPAY_BANK_CODE', 'MBBank');
    vi.stubEnv('SEPAY_BANK_BIN', '970422');
    vi.stubEnv('SEPAY_BANK_ACCOUNT_NUMBER', ACCOUNT);
    vi.stubEnv('SEPAY_BANK_ACCOUNT_NAME', 'BAN QUAN LY LANG NGHE BAT TRANG');
    vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'true');
    vi.stubEnv('VNPAY_TMN_CODE', 'TESTTMN1');
    vi.stubEnv('VNPAY_HASH_SECRET', VNPAY_SECRET);
    vi.stubEnv('MOMO_PARTNER_CODE', MOMO.partner);
    vi.stubEnv('MOMO_ACCESS_KEY', MOMO.access);
    vi.stubEnv('MOMO_SECRET_KEY', MOMO.secret);
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db, (builder) =>
      builder.overrideProvider(PAYMENT_HTTP).useValue(fakeMomoHttp),
    );
    buyer = await t.createUser('BUYER');
    stranger = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    const representative = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: representative.auth,
      body: { name: 'payment-household', slug: 'payment-household', history: '' },
    });
    expect(applied.status).toBe(201);
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    expect(approved.status).toBe(200);
    rep = { auth: representative.auth, householdId: applied.body.id };
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await t?.close();
    await db?.stop();
  });

  /** An accepted order of 100 units at 100 000 VND: total 10 000 000, deposit 3 000 000, balance 7 000 000. */
  async function acceptedOrder() {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        design: 'Logo cups',
        quantity: 100,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy,
        biddingClosesAt: deadline,
        invitedHouseholdIds: [rep.householdId],
        coordinationOptIn: true,
      },
    });
    expect(created.status).toBe(201);
    const sent = await t.request({
      method: 'POST',
      url: `/rfqs/${created.body.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': String(created.body.version) },
    });
    const coordinated = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/coordinate`,
      auth: admin.auth,
      headers: { 'if-match': String(sent.body.version) },
    });
    expect(coordinated.status).toBe(200);
    const offer = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/contributions`,
      auth: rep.auth,
      body: { maxQuantity: 100, unitPriceVnd: 100_000, completionDate },
    });
    expect(offer.status).toBe(201);
    const current = await t.request({
      method: 'GET',
      url: `/rfqs/${sent.body.id}`,
      auth: buyer.auth,
    });
    const quotation = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/quotations`,
      auth: admin.auth,
      headers: { 'if-match': String(current.body.version) },
      body: {
        parts: [
          {
            householdId: rep.householdId,
            quantity: 100,
            unitPriceVnd: 100_000,
            completionDate,
            contributionVersion: offer.body.version,
          },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(quotation.status).toBe(201);
    const read = await t.request({ method: 'GET', url: `/rfqs/${sent.body.id}`, auth: buyer.auth });
    const accepted = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/accept`,
      auth: buyer.auth,
      headers: { 'if-match': String(read.body.version) },
      body: { quotationId: quotation.body.id },
    });
    expect(accepted.status).toBe(200);
    return sent.body.id as string;
  }

  async function confirmAllocations(requestId: string) {
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: rep.auth,
    });
    const confirmed = await t.request({
      method: 'POST',
      url: `/allocations/${own.body[0].id}/confirm`,
      auth: rep.auth,
      headers: { 'if-match': String(own.body[0].version) },
    });
    expect(confirmed.status).toBe(200);
  }

  async function startProduction(requestId: string) {
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: admin.auth });
    return t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/start-production`,
      auth: admin.auth,
      headers: { 'if-match': String(read.body.version) },
    });
  }

  async function startPayment(
    requestId: string,
    kind: 'DEPOSIT' | 'BALANCE',
    method: 'SEPAY_TRANSFER' | 'VNPAY' | 'MOMO',
    auth = buyer.auth,
  ) {
    return t.request({
      method: 'POST',
      url: `/orders/${requestId}/payments`,
      auth,
      body: { kind, method },
    });
  }

  const sepayEvent = (payment: PaymentDto, overrides: Record<string, unknown> = {}) => ({
    id: Math.floor(Math.random() * 1e9),
    gateway: 'MBBank',
    transactionDate: '2026-11-08 14:02:37',
    accountNumber: ACCOUNT,
    code: null,
    content: `MBVCB.1 ${payment.referenceCode} cam on`,
    transferType: 'in',
    transferAmount: payment.amountVnd,
    accumulated: 1,
    subAccount: null,
    referenceCode: 'MB.1',
    description: '',
    ...overrides,
  });

  const sepayWebhook = (body: unknown, key = SEPAY_KEY) =>
    t.request({
      method: 'POST',
      url: '/payments/webhooks/sepay',
      headers: { authorization: `Apikey ${key}` },
      body,
    });

  const status = async (payment: PaymentDto, auth = buyer.auth) =>
    (await t.request({ method: 'GET', url: `/payments/${payment.referenceCode}`, auth })).body;

  const notices = async (auth: string) =>
    (await t.request({ method: 'GET', url: '/me/notifications', auth })).body.data as Array<{
      type: string;
      target: { id: string } | null;
    }>;

  it('migration matches the entities: no schema drift after running the migrations', async () => {
    expect((await db.orm.schema.getUpdateSchemaSQL()).trim()).toBe('');
  });

  describe('SePay bank transfer and VietQR', () => {
    it('creates a deposit of 30 % with a unique payment code and bank details', async () => {
      const requestId = await acceptedOrder();
      const summary = await t.request({
        method: 'GET',
        url: `/orders/${requestId}/payments`,
        auth: buyer.auth,
      });
      expect(summary.status).toBe(200);
      expect(OrderPaymentsResponseSchema.safeParse(summary.body).success).toBe(true);
      expect(summary.body).toMatchObject({
        totalVnd: 10_000_000,
        depositPercent: 30,
        depositAmountVnd: 3_000_000,
        balanceAmountVnd: 7_000_000,
        depositRequired: true,
        methods: ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'],
        methodOptions: [
          { method: 'SEPAY_TRANSFER', sandbox: false, minAmountVnd: 1, maxAmountVnd: null },
          { method: 'VNPAY', sandbox: true, minAmountVnd: 5_000, maxAmountVnd: 999_999_999 },
          { method: 'MOMO', sandbox: true, minAmountVnd: 1_000, maxAmountVnd: 50_000_000 },
        ],
        simulateAvailable: true,
        payments: [],
      });

      const created = await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER');
      expect(created.status).toBe(201);
      expect(PaymentResponseSchema.safeParse(created.body).success).toBe(true);
      expect(created.body).toMatchObject({
        kind: 'DEPOSIT',
        method: 'SEPAY_TRANSFER',
        provider: 'SEPAY',
        amountVnd: 3_000_000,
        status: 'PENDING',
      });
      expect(created.body.referenceCode).toMatch(/^VCP[2-9A-HJKMNP-Z]{10}$/);
      expect(created.body.checkout).toMatchObject({
        type: 'BANK_TRANSFER',
        accountNumber: ACCOUNT,
        transferContent: created.body.referenceCode,
      });
      expect(created.body.checkout.qrImageUrl).toContain('qr.sepay.vn');
      expect(created.body.checkout.qrPayload).toContain(created.body.referenceCode);

      // Starting the same payment again resumes it instead of piling up pending rows.
      const again = await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER');
      expect(again.body.id).toBe(created.body.id);
    });

    it('keeps orders private and refuses what the order cannot take', async () => {
      const requestId = await acceptedOrder();
      expect(
        (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER', stranger.auth)).status,
      ).toBe(404);
      expect(
        (
          await t.request({
            method: 'GET',
            url: `/orders/${requestId}/payments`,
            auth: stranger.auth,
          })
        ).status,
      ).toBe(404);
      expect(
        (await t.request({ method: 'GET', url: `/orders/${requestId}/payments` })).status,
      ).toBe(401);
      // The balance waits for the deposit.
      const early = await startPayment(requestId, 'BALANCE', 'SEPAY_TRANSFER');
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('PAYMENT_DEPOSIT_REQUIRED');
      // An amount in the body is not accepted: the server sets it.
      const forged = await t.request({
        method: 'POST',
        url: `/orders/${requestId}/payments`,
        auth: buyer.auth,
        body: { kind: 'DEPOSIT', method: 'SEPAY_TRANSFER', amountVnd: 1 },
      });
      expect(forged.status).toBe(422);
      // A request that is not an order yet has nothing to pay.
      const draft = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: buyer.auth,
        body: {
          design: 'Draft',
          quantity: 1,
          unit: 'cup',
          destination: 'Ha Noi',
          requiredBy,
          biddingClosesAt: deadline,
          invitedHouseholdIds: [rep.householdId],
        },
      });
      expect((await startPayment(draft.body.id, 'DEPOSIT', 'SEPAY_TRANSFER')).status).toBe(404);
    });

    it('rejects a webhook without the API key and does not touch the payment', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const missing = await t.request({
        method: 'POST',
        url: '/payments/webhooks/sepay',
        body: sepayEvent(payment),
      });
      expect(missing.status).toBe(401);
      expect(missing.body.code).toBe('PAYMENT_WEBHOOK_REJECTED');
      expect((await sepayWebhook(sepayEvent(payment), 'wrong-key')).status).toBe(401);
      expect((await status(payment)).status).toBe('PENDING');
    });

    it('marks the deposit paid from a signed webhook, once, and tells the buyer and the board', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const event = sepayEvent(payment);
      const first = await sepayWebhook(event);
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ success: true });
      const paid = await status(payment);
      expect(paid).toMatchObject({ status: 'PAID', checkout: null });
      expect(paid.paidAt).not.toBeNull();

      // SePay retries the same transaction: nothing changes, nothing is notified twice.
      const replay = await sepayWebhook(event);
      expect(replay.status).toBe(200);
      const owned = (await notices(buyer.auth)).filter(
        (n) => n.type === 'PAYMENT_PAID' && n.target?.id === requestId,
      );
      expect(owned).toHaveLength(1);
      expect(
        (await notices(admin.auth)).filter(
          (n) => n.type === 'PAYMENT_PAID' && n.target?.id === requestId,
        ),
      ).toHaveLength(1);

      // A second transfer for the same code (new SePay id) is already settled and changes nothing.
      await sepayWebhook(sepayEvent(payment));
      expect((await status(payment)).status).toBe('PAID');
      const summary = await t.request({
        method: 'GET',
        url: `/orders/${requestId}/payments`,
        auth: buyer.auth,
      });
      expect(summary.body.depositPaidAt).toBe(paid.paidAt);
      expect(summary.body.payments).toHaveLength(1);
    });

    it('needs the exact amount: a short or long transfer leaves the payment pending', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      for (const amount of [payment.amountVnd - 1, payment.amountVnd + 1]) {
        const res = await sepayWebhook(sepayEvent(payment, { transferAmount: amount }));
        expect(res.status).toBe(200);
        expect((await status(payment)).status).toBe('PENDING');
      }
      const row = await db.orm.em
        .fork()
        .findOneOrFail(Payment, { referenceCode: payment.referenceCode });
      expect(row.rawLastEvent).toMatchObject({
        mismatch: { expectedAmountVnd: 3_000_000, receivedAmountVnd: 3_000_001 },
      });
      expect(row.providerTxnId).toBeNull();
    });

    it('ignores outgoing transfers, other accounts and unknown payment codes', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      for (const overrides of [
        { transferType: 'out' },
        { accountNumber: '555' },
        { content: 'VCPAAAAAAAAAA' },
        { content: 'no code' },
      ]) {
        expect((await sepayWebhook(sepayEvent(payment, overrides))).status).toBe(200);
      }
      expect((await status(payment)).status).toBe('PENDING');
    });

    it('gates production on a paid deposit', async () => {
      const requestId = await acceptedOrder();
      await confirmAllocations(requestId);
      const blocked = await startProduction(requestId);
      expect(blocked.status).toBe(409);
      expect(blocked.body.code).toBe('PAYMENT_DEPOSIT_REQUIRED');

      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      expect((await startProduction(requestId)).status).toBe(409);
      await sepayWebhook(sepayEvent(payment));
      const started = await startProduction(requestId);
      expect(started.status).toBe(200);
      expect(started.body.status).toBe('IN_PRODUCTION');
    });

    it('expires a stale pending payment in the worker, then still honours a late transfer', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const em = db.orm.em.fork();
      const row = await em.findOneOrFail(Payment, { referenceCode: payment.referenceCode });
      row.expiresAt = new Date(Date.now() - 1_000);
      await em.flush();

      const outcomes = await expireDuePayments(db.orm);
      expect(outcomes).toContain('EXPIRED');
      expect((await status(payment)).status).toBe('EXPIRED');
      expect(await expireDuePayments(db.orm)).not.toContain('EXPIRED');
      expect(
        (await notices(buyer.auth)).filter(
          (n) => n.type === 'PAYMENT_EXPIRED' && n.target?.id === requestId,
        ),
      ).toHaveLength(1);

      // The money arrives after all: the exact transfer settles the expired payment.
      await sepayWebhook(sepayEvent(payment));
      expect((await status(payment)).status).toBe('PAID');
    });

    it('replaces an expired pending payment with a fresh one on the next start', async () => {
      const requestId = await acceptedOrder();
      const first = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const em = db.orm.em.fork();
      const row = await em.findOneOrFail(Payment, { referenceCode: first.referenceCode });
      row.expiresAt = new Date(Date.now() - 1_000);
      await em.flush();
      const second = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      expect(second.referenceCode).not.toBe(first.referenceCode);
      expect((await status(first)).status).toBe('EXPIRED');
    });

    it('lets the buyer cancel a pending payment, and a switch of method cancels the old one', async () => {
      const requestId = await acceptedOrder();
      const bank = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const wallet = await startPayment(requestId, 'DEPOSIT', 'MOMO');
      expect(wallet.status).toBe(201);
      expect((await status(bank)).status).toBe('CANCELLED');
      // A transfer for the cancelled payment does not revive it.
      await sepayWebhook(sepayEvent(bank));
      expect((await status(bank)).status).toBe('CANCELLED');
      const cancelled = await t.request({
        method: 'POST',
        url: `/payments/${wallet.body.referenceCode}/cancel`,
        auth: buyer.auth,
      });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.status).toBe('CANCELLED');
      const stranded = await t.request({
        method: 'POST',
        url: `/payments/${wallet.body.referenceCode}/cancel`,
        auth: stranger.auth,
      });
      expect(stranded.status).toBe(404);
    });

    it('lets the buyer and an administrator read a payment, nobody else', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      expect((await status(payment, admin.auth)).status).toBe('PENDING');
      const hidden = await t.request({
        method: 'GET',
        url: `/payments/${payment.referenceCode}`,
        auth: stranger.auth,
      });
      expect(hidden.status).toBe(404);
      const bad = await t.request({ method: 'GET', url: '/payments/not-a-code', auth: buyer.auth });
      expect(bad.status).toBe(404);
    });

    it('simulates a transfer for the sandbox, only when APP_ENV is not production', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      expect(
        (
          await t.request({
            method: 'POST',
            url: `/admin/payments/${payment.id}/simulate-transfer`,
            auth: buyer.auth,
          })
        ).status,
      ).toBe(403);
      vi.stubEnv('APP_ENV', 'production');
      const refused = await t.request({
        method: 'POST',
        url: `/admin/payments/${payment.id}/simulate-transfer`,
        auth: admin.auth,
      });
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
      vi.stubEnv('APP_ENV', 'development');
      const simulated = await t.request({
        method: 'POST',
        url: `/admin/payments/${payment.id}/simulate-transfer`,
        auth: admin.auth,
      });
      expect(simulated.status).toBe(200);
      expect(simulated.body.status).toBe('PAID');
      const audit = await t.request({
        method: 'GET',
        url: '/admin/audit-log?action=payment.simulate_transfer',
        auth: admin.auth,
      });
      expect(audit.body.data[0]).toMatchObject({ entityId: payment.id });
    });
  });

  describe('administration', () => {
    async function paidOrder() {
      const requestId = await acceptedOrder();
      const deposit = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      await sepayWebhook(sepayEvent(deposit));
      await confirmAllocations(requestId);
      expect((await startProduction(requestId)).status).toBe(200);
      return { requestId, deposit };
    }

    it('records an offline balance, audit-logged, and tells the buyer', async () => {
      const { requestId, deposit } = await paidOrder();
      const refused = await t.request({
        method: 'POST',
        url: `/admin/orders/${requestId}/payments/offline`,
        auth: buyer.auth,
        body: { note: 'cash' },
      });
      expect(refused.status).toBe(403);
      const noNote = await t.request({
        method: 'POST',
        url: `/admin/orders/${requestId}/payments/offline`,
        auth: admin.auth,
        body: {},
      });
      expect(noNote.status).toBe(422);

      // An online balance still waiting is cancelled so the buyer cannot pay twice.
      const pending = (await startPayment(requestId, 'BALANCE', 'SEPAY_TRANSFER')).body;
      expect(pending.amountVnd).toBe(7_000_000);
      const recorded = await t.request({
        method: 'POST',
        url: `/admin/orders/${requestId}/payments/offline`,
        auth: admin.auth,
        body: { note: 'Cash handed over at the office, receipt 0042' },
      });
      expect(recorded.status).toBe(201);
      expect(recorded.body).toMatchObject({
        kind: 'BALANCE',
        method: 'OFFLINE',
        provider: null,
        amountVnd: 7_000_000,
        status: 'PAID',
        expiresAt: null,
        note: 'Cash handed over at the office, receipt 0042',
      });
      expect((await status(pending)).status).toBe('CANCELLED');
      const audit = await t.request({
        method: 'GET',
        url: '/admin/audit-log?action=payment.record_offline',
        auth: admin.auth,
      });
      expect(audit.body.data[0]).toMatchObject({
        actorId: admin.id,
        entity: 'payment',
        entityId: recorded.body.id,
      });
      expect(
        (await notices(buyer.auth)).filter(
          (n) => n.type === 'PAYMENT_PAID' && n.target?.id === requestId,
        ),
      ).toHaveLength(2);

      const twice = await t.request({
        method: 'POST',
        url: `/admin/orders/${requestId}/payments/offline`,
        auth: admin.auth,
        body: { note: 'Again' },
      });
      expect(twice.status).toBe(409);
      expect(twice.body.code).toBe('PAYMENT_ALREADY_PAID');
      const summary = await t.request({
        method: 'GET',
        url: `/orders/${requestId}/payments`,
        auth: admin.auth,
      });
      expect(summary.body.balancePaidAt).not.toBeNull();
      expect(summary.body.depositPaidAt).toBe((await status(deposit)).paidAt);
    });

    it('marks a paid payment refunded with a reason, audit-logged, without calling a gateway', async () => {
      const { deposit } = await paidOrder();
      const row = await t.request({
        method: 'GET',
        url: `/admin/payments?status=PAID&kind=DEPOSIT`,
        auth: admin.auth,
      });
      const listed = row.body.data.find((p: { id: string }) => p.id === deposit.id);
      expect(listed.buyerName).toEqual(expect.any(String));
      expect(listed).toHaveProperty('orderTitle');

      const noReason = await t.request({
        method: 'POST',
        url: `/admin/payments/${deposit.id}/refund`,
        auth: admin.auth,
        headers: { 'if-match': String(listed.version) },
        body: { reason: ' ' },
      });
      expect(noReason.status).toBe(422);
      const stale = await t.request({
        method: 'POST',
        url: `/admin/payments/${deposit.id}/refund`,
        auth: admin.auth,
        headers: { 'if-match': String(listed.version + 5) },
        body: { reason: 'Order cancelled' },
      });
      expect(stale.status).toBe(409);
      expect(stale.body.code).toBe('STALE_VERSION');
      const asBuyer = await t.request({
        method: 'POST',
        url: `/admin/payments/${deposit.id}/refund`,
        auth: buyer.auth,
        headers: { 'if-match': String(listed.version) },
        body: { reason: 'Please' },
      });
      expect(asBuyer.status).toBe(403);

      const refunded = await t.request({
        method: 'POST',
        url: `/admin/payments/${deposit.id}/refund`,
        auth: admin.auth,
        headers: { 'if-match': String(listed.version) },
        body: { reason: 'Order cancelled, money returned by transfer' },
      });
      expect(refunded.status).toBe(200);
      expect(refunded.body).toMatchObject({
        status: 'REFUNDED',
        refundReason: 'Order cancelled, money returned by transfer',
      });
      expect(refunded.body.refundedAt).not.toBeNull();
      const again = await t.request({
        method: 'POST',
        url: `/admin/payments/${deposit.id}/refund`,
        auth: admin.auth,
        headers: { 'if-match': String(refunded.body.version) },
        body: { reason: 'Twice' },
      });
      expect(again.status).toBe(409);
      expect(again.body.code).toBe('INVALID_TRANSITION');
      const audit = await t.request({
        method: 'GET',
        url: '/admin/audit-log?action=payment.refund',
        auth: admin.auth,
      });
      expect(audit.body.data[0]).toMatchObject({
        entityId: deposit.id,
        before: { status: 'PAID' },
        after: { status: 'REFUNDED', reason: 'Order cancelled, money returned by transfer' },
      });
      expect((await notices(buyer.auth)).some((n) => n.type === 'PAYMENT_REFUNDED')).toBe(true);
    });

    it('cancels a payment still waiting when the order is cancelled', async () => {
      const requestId = await acceptedOrder();
      const payment = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: admin.auth });
      const cancelled = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/cancel`,
        auth: admin.auth,
        headers: { 'if-match': String(read.body.version) },
        body: { reason: 'Buyer withdrew the order' },
      });
      expect(cancelled.status).toBe(200);
      expect((await status(payment)).status).toBe('CANCELLED');
      // Money that still arrives is not applied to the cancelled order.
      await sepayWebhook(sepayEvent(payment));
      expect((await status(payment)).status).toBe('CANCELLED');
    });

    it('lists payments newest first with filters and a cursor, for administrators only', async () => {
      const first = await t.request({
        method: 'GET',
        url: '/admin/payments?limit=2',
        auth: admin.auth,
      });
      expect(first.status).toBe(200);
      expect(first.body.data).toHaveLength(2);
      expect(first.body.nextCursor).not.toBeNull();
      const second = await t.request({
        method: 'GET',
        url: `/admin/payments?limit=2&cursor=${first.body.nextCursor}`,
        auth: admin.auth,
      });
      expect(second.body.data[0].id).not.toBe(first.body.data[0].id);
      expect(
        (first.body.data as Array<{ createdAt: string }>).every(
          (p, i, all) => i === 0 || (all[i - 1]?.createdAt ?? '') >= p.createdAt,
        ),
      ).toBe(true);
      const pending = await t.request({
        method: 'GET',
        url: '/admin/payments?status=PENDING&method=SEPAY_TRANSFER',
        auth: admin.auth,
      });
      expect(
        pending.body.data.every(
          (p: { status: string; method: string }) =>
            p.status === 'PENDING' && p.method === 'SEPAY_TRANSFER',
        ),
      ).toBe(true);
      expect(
        (await t.request({ method: 'GET', url: '/admin/payments', auth: buyer.auth })).status,
      ).toBe(403);
      expect(
        (await t.request({ method: 'GET', url: '/admin/payments?cursor=junk', auth: admin.auth }))
          .status,
      ).toBe(400);
    });
  });

  describe('VNPay sandbox', () => {
    const signed = (fields: Record<string, string>, secret = VNPAY_SECRET) => {
      const data = Object.keys(fields)
        .sort()
        .map((key) => `${key}=${encodeURIComponent(fields[key] as string).replace(/%20/g, '+')}`)
        .join('&');
      return {
        ...fields,
        vnp_SecureHash: createHmac('sha512', secret).update(data, 'utf8').digest('hex'),
      };
    };
    const ipn = (payment: PaymentDto, overrides: Record<string, string> = {}) =>
      signed({
        vnp_TmnCode: 'TESTTMN1',
        vnp_Amount: String(payment.amountVnd * 100),
        vnp_BankCode: 'NCB',
        vnp_OrderInfo: `vCraft ${payment.referenceCode}`,
        vnp_PayDate: '20261108210000',
        vnp_ResponseCode: '00',
        vnp_TransactionNo: String(Math.floor(Math.random() * 1e8)),
        vnp_TransactionStatus: '00',
        vnp_TxnRef: payment.referenceCode,
        ...overrides,
      });
    const call = (path: string, query: Record<string, string>) =>
      t.request({ method: 'GET', url: `${path}?${new URLSearchParams(query)}` });

    it('creates a signed redirect URL, settles on a signed IPN, and ignores the browser return', async () => {
      const requestId = await acceptedOrder();
      const created = await startPayment(requestId, 'DEPOSIT', 'VNPAY');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ method: 'VNPAY', provider: 'VNPAY', status: 'PENDING' });
      expect(created.body.checkout.type).toBe('REDIRECT');
      const url = new URL(created.body.checkout.url);
      expect(url.hostname).toBe('sandbox.vnpayment.vn');
      expect(url.searchParams.get('vnp_Amount')).toBe('300000000');
      expect(url.searchParams.get('vnp_TxnRef')).toBe(created.body.referenceCode);
      expect(url.searchParams.get('vnp_ReturnUrl')).toBe(
        'https://vcraft.test/api/v1/payments/return/vnpay',
      );

      // The buyer's browser comes back, with a correctly signed success query: it only forwards to the status page.
      const back = await t.request({
        method: 'GET',
        url: `/payments/return/vnpay?${new URLSearchParams(ipn(created.body))}`,
      });
      expect(back.status).toBe(302);
      expect(back.headers.location).toBe(
        `https://vcraft.test/vi/thanh-toan/${created.body.referenceCode}`,
      );
      expect((await status(created.body)).status).toBe('PENDING');
      const forged = await call('/payments/return/vnpay', {
        vnp_TxnRef: created.body.referenceCode,
      });
      expect(forged.status).toBe(302);
      expect(forged.headers.location).toBe('https://vcraft.test/vi/yeu-cau-bao-gia');

      const tampered = await call('/payments/webhooks/vnpay', {
        ...ipn(created.body),
        vnp_Amount: '100',
      });
      expect(tampered.body).toEqual({ RspCode: '97', Message: 'Invalid signature' });
      const wrongAmount = await call(
        '/payments/webhooks/vnpay',
        ipn(created.body, { vnp_Amount: '100000' }),
      );
      expect(wrongAmount.body.RspCode).toBe('04');
      expect((await status(created.body)).status).toBe('PENDING');

      const event = ipn(created.body);
      const ok = await call('/payments/webhooks/vnpay', event);
      expect(ok.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
      expect((await status(created.body)).status).toBe('PAID');
      const replay = await call('/payments/webhooks/vnpay', event);
      expect(replay.body.RspCode).toBe('02');
      const unknown = await call(
        '/payments/webhooks/vnpay',
        ipn({ ...created.body, referenceCode: 'VCPNOSUCHCODE' }),
      );
      expect(unknown.body.RspCode).toBe('01');
    });

    it('marks a declined payment failed', async () => {
      const requestId = await acceptedOrder();
      const created = (await startPayment(requestId, 'DEPOSIT', 'VNPAY')).body;
      const res = await call(
        '/payments/webhooks/vnpay',
        ipn(created, { vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
      );
      expect(res.body.RspCode).toBe('00');
      expect((await status(created)).status).toBe('FAILED');
      // The buyer can start over.
      expect((await startPayment(requestId, 'DEPOSIT', 'VNPAY')).status).toBe(201);
    });
  });

  describe('MoMo sandbox', () => {
    const ipn = (payment: PaymentDto, overrides: Record<string, string | number> = {}) => {
      const fields = {
        partnerCode: MOMO.partner,
        orderId: payment.referenceCode,
        requestId: 'req-1',
        amount: payment.amountVnd,
        orderInfo: `vCraft ${payment.referenceCode}`,
        orderType: 'momo_wallet',
        transId: Math.floor(Math.random() * 1e9),
        resultCode: 0,
        message: 'Successful.',
        payType: 'qr',
        responseTime: 1_762_600_000_000,
        extraData: '',
        ...overrides,
      };
      const raw =
        `accessKey=${MOMO.access}&amount=${fields.amount}&extraData=${fields.extraData}` +
        `&message=${fields.message}&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}` +
        `&orderType=${fields.orderType}&partnerCode=${fields.partnerCode}&payType=${fields.payType}` +
        `&requestId=${fields.requestId}&responseTime=${fields.responseTime}` +
        `&resultCode=${fields.resultCode}&transId=${fields.transId}`;
      return { ...fields, signature: createHmac('sha256', MOMO.secret).update(raw).digest('hex') };
    };
    const post = (body: unknown) =>
      t.request({ method: 'POST', url: '/payments/webhooks/momo', body });

    it('creates a payment through the (fake) endpoint and settles on a signed IPN', async () => {
      momoRequests.length = 0;
      const requestId = await acceptedOrder();
      const created = await startPayment(requestId, 'DEPOSIT', 'MOMO');
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({
        method: 'MOMO',
        provider: 'MOMO',
        amountVnd: 3_000_000,
      });
      expect(created.body.checkout).toMatchObject({
        type: 'REDIRECT',
        url: `https://test-payment.momo.vn/pay/${created.body.referenceCode}`,
        deeplink: 'momo://pay',
      });
      expect(momoRequests).toHaveLength(1);
      expect(momoRequests[0]).toMatchObject({
        orderId: created.body.referenceCode,
        amount: 3_000_000,
        requestType: 'captureWallet',
        ipnUrl: 'https://vcraft.test/api/v1/payments/webhooks/momo',
      });

      expect((await post({ ...ipn(created.body), signature: 'forged' })).status).toBe(401);
      expect((await post({ ...ipn(created.body), amount: 1 })).status).toBe(401);
      expect((await post({})).status).toBe(401);
      expect((await status(created.body)).status).toBe('PENDING');

      const event = ipn(created.body);
      const ok = await post(event);
      expect(ok.status).toBe(204);
      expect((await status(created.body)).status).toBe('PAID');
      expect((await post(event)).status).toBe(204);
      expect(
        (await notices(buyer.auth)).filter(
          (n) => n.type === 'PAYMENT_PAID' && n.target?.id === requestId,
        ),
      ).toHaveLength(1);

      const back = await t.request({
        method: 'GET',
        url: `/payments/return/momo?${new URLSearchParams(
          Object.fromEntries(Object.entries(event).map(([k, v]) => [k, String(v)])),
        )}`,
      });
      expect(back.status).toBe(302);
      expect(back.headers.location).toBe(
        `https://vcraft.test/vi/thanh-toan/${created.body.referenceCode}`,
      );
    });

    it('calls MoMo outside the order lock, so a slow provider does not block the order', async () => {
      const requestId = await acceptedOrder();
      let release!: () => void;
      let entered!: () => void;
      const calling = new Promise<void>((resolve) => {
        entered = resolve;
      });
      momoControl.gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      momoControl.entered = entered;
      try {
        const pending = startPayment(requestId, 'DEPOSIT', 'MOMO');
        await calling;
        // The provider call is open now: the order row must be lockable at once (short wait, then it would fail).
        await db.orm.em.fork().transactional(async (em) => {
          await em
            .getConnection()
            .execute(
              resolveDbDriver(process.env) === 'mysql'
                ? 'SET SESSION innodb_lock_wait_timeout = 1'
                : "SET LOCAL lock_timeout = '1s'",
              [],
              'run',
              em.getTransactionContext(),
            );
          const locked = await em.findOne(
            QuotationRequest,
            { id: requestId },
            { lockMode: LockMode.PESSIMISTIC_WRITE },
          );
          expect(locked?.id).toBe(requestId);
        });
        // A second start of the same payment while the provider is still answering is refused, not duplicated.
        const second = await startPayment(requestId, 'DEPOSIT', 'MOMO');
        expect(second.status).toBe(409);
        release();
        const created = await pending;
        expect(created.status).toBe(201);
        expect(created.body.checkout).toMatchObject({ type: 'REDIRECT' });
      } finally {
        release();
        momoControl.gate = undefined;
        momoControl.entered = undefined;
      }
    });

    it('marks the payment FAILED and answers 503 when MoMo cannot be reached', async () => {
      const requestId = await acceptedOrder();
      momoControl.fail = true;
      try {
        const failed = await startPayment(requestId, 'DEPOSIT', 'MOMO');
        expect(failed.status).toBe(503);
      } finally {
        momoControl.fail = false;
      }
      const stored = await db.orm.em.fork().find(Payment, { order: requestId });
      expect(stored.map((p) => p.status)).toEqual(['FAILED']);
      const retry = await startPayment(requestId, 'DEPOSIT', 'MOMO');
      expect(retry.status).toBe(201);
    });

    it('marks a failed MoMo result failed', async () => {
      const requestId = await acceptedOrder();
      const created = (await startPayment(requestId, 'DEPOSIT', 'MOMO')).body;
      expect((await post(ipn(created, { resultCode: 1006, message: 'Declined' }))).status).toBe(
        204,
      );
      expect((await status(created)).status).toBe('FAILED');
    });
  });

  describe('modes, limits and expiry (ADR-0024)', () => {
    const restore = (...names: string[]) => {
      for (const name of names) vi.stubEnv(name, '');
    };

    it('refuses an amount outside the limits of the method with PAYMENT_AMOUNT_OUT_OF_RANGE', async () => {
      const requestId = await acceptedOrder();
      vi.stubEnv('MOMO_MAX_AMOUNT_VND', '2000000');
      vi.stubEnv('VNPAY_MAX_AMOUNT_VND', '2999999');
      try {
        for (const method of ['MOMO', 'VNPAY'] as const) {
          const res = await startPayment(requestId, 'DEPOSIT', method);
          expect(res.status).toBe(409);
          expect(res.body.code).toBe('PAYMENT_AMOUNT_OUT_OF_RANGE');
        }
        const summary = await t.request({
          method: 'GET',
          url: `/orders/${requestId}/payments`,
          auth: buyer.auth,
        });
        expect(summary.body.methodOptions).toMatchObject([
          { method: 'SEPAY_TRANSFER', maxAmountVnd: null },
          { method: 'VNPAY', maxAmountVnd: 2_999_999 },
          { method: 'MOMO', maxAmountVnd: 2_000_000 },
        ]);
        // Bank transfer has no upper limit.
        expect((await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).status).toBe(201);
        // No payment row was left behind by the refused starts.
        const rows = await db.orm.em.fork().find(Payment, { order: requestId });
        expect(rows.map((p) => p.method)).toEqual(['SEPAY_TRANSFER']);
      } finally {
        restore('MOMO_MAX_AMOUNT_VND', 'VNPAY_MAX_AMOUNT_VND');
      }
    });

    it('gives a wallet payment the short expiry and a bank transfer the long one', async () => {
      const requestId = await acceptedOrder();
      const wallet = (await startPayment(requestId, 'DEPOSIT', 'VNPAY')).body;
      const em = db.orm.em.fork();
      const walletRow = await em.findOneOrFail(Payment, { referenceCode: wallet.referenceCode });
      const walletMs = (walletRow.expiresAt as Date).getTime() - walletRow.createdAt.getTime();
      expect(Math.abs(walletMs - 30 * 60_000)).toBeLessThan(5_000);
      // The VNPay URL carries the same expiry.
      expect(new URL(wallet.checkout.url).searchParams.get('vnp_ExpireDate')).toMatch(/^\d{14}$/);

      vi.stubEnv('PAYMENT_WALLET_EXPIRES_IN_MINUTES', '10');
      try {
        const momo = (await startPayment(requestId, 'DEPOSIT', 'MOMO')).body;
        const row = await em.findOneOrFail(Payment, { referenceCode: momo.referenceCode });
        const ms = (row.expiresAt as Date).getTime() - row.createdAt.getTime();
        expect(Math.abs(ms - 10 * 60_000)).toBeLessThan(5_000);
      } finally {
        restore('PAYMENT_WALLET_EXPIRES_IN_MINUTES');
      }
      const bank = (await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).body;
      const bankRow = await em.findOneOrFail(Payment, { referenceCode: bank.referenceCode });
      const bankMs = (bankRow.expiresAt as Date).getTime() - bankRow.createdAt.getTime();
      expect(Math.abs(bankMs - 24 * 3_600_000)).toBeLessThan(5_000);
    });

    it('offers VNPay in production mode on the URLs from the environment, flagged as real money', async () => {
      vi.stubEnv('VNPAY_MODE', 'production');
      vi.stubEnv('VNPAY_PAY_URL', 'https://pay.vnpay.test/vpcpay.html');
      vi.stubEnv('VNPAY_API_URL', 'https://api.vnpay.test/transaction');
      try {
        const requestId = await acceptedOrder();
        const summary = await t.request({
          method: 'GET',
          url: `/orders/${requestId}/payments`,
          auth: buyer.auth,
        });
        expect(OrderPaymentsResponseSchema.safeParse(summary.body).success).toBe(true);
        expect(summary.body.methodOptions).toMatchObject([
          { method: 'SEPAY_TRANSFER', sandbox: false },
          { method: 'VNPAY', sandbox: false },
          { method: 'MOMO', sandbox: true },
        ]);
        const created = await startPayment(requestId, 'DEPOSIT', 'VNPAY');
        expect(created.status).toBe(201);
        expect(new URL(created.body.checkout.url).origin).toBe('https://pay.vnpay.test');
      } finally {
        restore('VNPAY_MODE', 'VNPAY_PAY_URL', 'VNPAY_API_URL');
      }
    });

    it('never offers a sandbox gateway while APP_ENV=production', async () => {
      vi.stubEnv('APP_ENV', 'production');
      try {
        const requestId = await acceptedOrder();
        const summary = await t.request({
          method: 'GET',
          url: `/orders/${requestId}/payments`,
          auth: buyer.auth,
        });
        expect(summary.body.methods).toEqual(['SEPAY_TRANSFER']);
        expect(summary.body.simulateAvailable).toBe(false);
        for (const method of ['VNPAY', 'MOMO'] as const) {
          const res = await startPayment(requestId, 'DEPOSIT', method);
          expect(res.status).toBe(409);
          expect(res.body.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
        }
      } finally {
        vi.stubEnv('APP_ENV', 'development');
      }
    });
  });

  describe('feature flag', () => {
    it('hides VNPay and MoMo and refuses them while PAYMENTS_SANDBOX_GATEWAYS is off', async () => {
      vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'false');
      try {
        const requestId = await acceptedOrder();
        const summary = await t.request({
          method: 'GET',
          url: `/orders/${requestId}/payments`,
          auth: buyer.auth,
        });
        expect(summary.body.methods).toEqual(['SEPAY_TRANSFER']);
        for (const method of ['VNPAY', 'MOMO'] as const) {
          const res = await startPayment(requestId, 'DEPOSIT', method);
          expect(res.status).toBe(409);
          expect(res.body.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
        }
      } finally {
        vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'true');
      }
    });

    it('offers nothing and does not gate production when SePay is not configured', async () => {
      vi.stubEnv('SEPAY_WEBHOOK_API_KEY', '');
      try {
        const requestId = await acceptedOrder();
        const summary = await t.request({
          method: 'GET',
          url: `/orders/${requestId}/payments`,
          auth: buyer.auth,
        });
        expect(summary.body).toMatchObject({ depositRequired: false });
        expect(summary.body.methods).toEqual(['VNPAY', 'MOMO']);
        expect((await startPayment(requestId, 'DEPOSIT', 'SEPAY_TRANSFER')).status).toBe(409);
        expect((await sepayWebhook({ id: 1 })).status).toBe(401);
        await confirmAllocations(requestId);
        expect((await startProduction(requestId)).status).toBe(200);
      } finally {
        vi.stubEnv('SEPAY_WEBHOOK_API_KEY', SEPAY_KEY);
      }
    });
  });
});
