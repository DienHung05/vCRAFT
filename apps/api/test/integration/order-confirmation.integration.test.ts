import { AllocationResponseSchema } from '@vcraft/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

describe('order confirmation, progress and receipt', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let stranger: { auth: string };
  let admin: { auth: string };
  let reps: Array<{ auth: string; householdId: string }>;
  const deadline = new Date(Date.now() + 86_400_000).toISOString();
  const completionDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const requiredBy = new Date(Date.now() + 20 * 86_400_000).toISOString();

  function representative(index: number) {
    const rep = reps[index];
    if (!rep) throw new Error(`missing representative ${index}`);
    return rep;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    stranger = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    reps = [];
    for (const name of ['order-household-a', 'order-household-b']) {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name, slug: name, history: '' },
      });
      expect(applied.status).toBe(201);
      const approved = await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
      expect(approved.status).toBe(200);
      reps.push({ auth: rep.auth, householdId: applied.body.id });
    }
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  async function freshRequest() {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        design: 'Logo cups',
        quantity: 3500,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy,
        biddingClosesAt: deadline,
        invitedHouseholdIds: reps.map((rep) => rep.householdId),
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
    expect(sent.status).toBe(200);
    const coordinated = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/coordinate`,
      auth: admin.auth,
      headers: { 'if-match': String(sent.body.version) },
    });
    expect(coordinated.status).toBe(200);
    for (const [index, rep] of reps.entries()) {
      const offer = await t.request({
        method: 'POST',
        url: `/rfqs/${sent.body.id}/contributions`,
        auth: rep.auth,
        body: {
          maxQuantity: index === 0 ? 2000 : 1500,
          unitPriceVnd: 30_000,
          completionDate,
        },
      });
      expect(offer.status).toBe(201);
    }
    const offers = await t.request({
      method: 'GET',
      url: `/rfqs/${sent.body.id}/contributions`,
      auth: admin.auth,
    });
    expect(offers.status).toBe(200);
    const current = await t.request({
      method: 'GET',
      url: `/rfqs/${sent.body.id}`,
      auth: buyer.auth,
    });
    expect(current.status).toBe(200);
    const quotation = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.body.id}/quotations`,
      auth: admin.auth,
      headers: { 'if-match': String(current.body.version) },
      body: {
        parts: offers.body.map(
          (offer: {
            householdId: string;
            maxQuantity: number;
            unitPriceVnd: number;
            completionDate: string;
            version: number;
          }) => ({
            householdId: offer.householdId,
            quantity: offer.maxQuantity,
            unitPriceVnd: offer.unitPriceVnd,
            completionDate: offer.completionDate,
            contributionVersion: offer.version,
          }),
        ),
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(quotation.status).toBe(201);
    return { requestId: sent.body.id as string, quotationId: quotation.body.id as string };
  }

  async function acceptFlow() {
    const { requestId, quotationId } = await freshRequest();
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: buyer.auth });
    expect(read.status).toBe(200);
    const accepted = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/accept`,
      auth: buyer.auth,
      headers: { 'if-match': String(read.body.version) },
      body: { quotationId },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    return { requestId, readVersion: read.body.version as number };
  }

  it('creates proposed allocations and refuses a stale accept', async () => {
    const { requestId, readVersion } = await acceptFlow();
    const target = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: admin.auth,
    });
    const allocations = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: buyer.auth,
    });
    expect(allocations.status).toBe(200);
    expect(allocations.body).toHaveLength(2);
    for (const allocation of allocations.body) {
      expect(AllocationResponseSchema.safeParse(allocation).success).toBe(true);
      expect(allocation.status).toBe('PROPOSED');
      expect(allocation.completedQty).toBe(0);
    }
    const stale = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/accept`,
      auth: buyer.auth,
      headers: { 'if-match': String(readVersion) },
      body: { quotationId: target.body[0].id },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
  });

  it('refuses accept from non-owner and hides allocations from strangers', async () => {
    const { requestId } = await freshRequest();
    const quotations = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: admin.auth,
    });
    expect(quotations.status).toBe(200);
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: admin.auth });
    const forbiddenAccept = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/accept`,
      auth: admin.auth,
      headers: { 'if-match': String(read.body.version) },
      body: { quotationId: quotations.body[0].id },
    });
    expect(forbiddenAccept.status).toBe(404);
    const strangerRead = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: stranger.auth,
    });
    expect(strangerRead.status).not.toBe(200);
  });

  it('requires every confirmation before production starts', async () => {
    const { requestId } = await acceptFlow();
    const rep0View = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: representative(0).auth,
    });
    expect(rep0View.status).toBe(200);
    expect(rep0View.body).toHaveLength(1);
    expect(rep0View.body[0].householdId).toBe(representative(0).householdId);
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: admin.auth });
    const early = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/start-production`,
      auth: admin.auth,
      headers: { 'if-match': String(read.body.version) },
    });
    expect(early.status).toBe(409);
    for (const rep of reps) {
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
      expect(confirmed.body.status).toBe('CONFIRMED');
    }
    const reread = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: admin.auth,
    });
    const started = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/start-production`,
      auth: admin.auth,
      headers: { 'if-match': String(reread.body.version) },
    });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('IN_PRODUCTION');
  });

  it('decline cancels the whole unstarted order but keeps history', async () => {
    const { requestId } = await acceptFlow();
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: representative(1).auth,
    });
    const declined = await t.request({
      method: 'POST',
      url: `/allocations/${own.body[0].id}/decline`,
      auth: representative(1).auth,
      headers: { 'if-match': String(own.body[0].version) },
    });
    expect(declined.status).toBe(200);
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: buyer.auth });
    expect(read.body.status).toBe('CANCELLED');
    const kept = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: buyer.auth,
    });
    expect(kept.status).toBe(200);
    expect(kept.body).toHaveLength(2);
    expect(kept.body.map((a: { status: string }) => a.status).sort()).toEqual([
      'CANCELLED',
      'DECLINED',
    ]);
  });

  it('bounds progress and confirms receipt only when all done', async () => {
    const { requestId } = await acceptFlow();
    for (const rep of reps) {
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
    const adminRead = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: admin.auth,
    });
    const started = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/start-production`,
      auth: admin.auth,
      headers: { 'if-match': String(adminRead.body.version) },
    });
    expect(started.status).toBe(200);
    const own0 = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: representative(0).auth,
    });
    const over = await t.request({
      method: 'POST',
      url: `/allocations/${own0.body[0].id}/progress`,
      auth: representative(0).auth,
      headers: { 'if-match': String(own0.body[0].version) },
      body: { completedQty: own0.body[0].quantity + 1 },
    });
    expect(over.status).toBe(422);
    const partial = await t.request({
      method: 'POST',
      url: `/allocations/${own0.body[0].id}/progress`,
      auth: representative(0).auth,
      headers: { 'if-match': String(own0.body[0].version) },
      body: { completedQty: 500 },
    });
    expect(partial.status).toBe(200);
    expect(partial.body.completedQty).toBe(500);
    expect(partial.body.status).toBe('IN_PROGRESS');
    const beforeAll = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: buyer.auth,
    });
    const earlyReceipt = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/receive`,
      auth: buyer.auth,
      headers: { 'if-match': String(beforeAll.body.version) },
    });
    expect(earlyReceipt.status).toBe(409);
    const full0 = await t.request({
      method: 'POST',
      url: `/allocations/${own0.body[0].id}/progress`,
      auth: representative(0).auth,
      headers: { 'if-match': String(partial.body.version) },
      body: { completedQty: own0.body[0].quantity },
    });
    expect(full0.status).toBe(200);
    expect(full0.body.status).toBe('DONE');
    const own1 = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/allocations`,
      auth: representative(1).auth,
    });
    const full1 = await t.request({
      method: 'POST',
      url: `/allocations/${own1.body[0].id}/progress`,
      auth: representative(1).auth,
      headers: { 'if-match': String(own1.body[0].version) },
      body: { completedQty: own1.body[0].quantity },
    });
    expect(full1.status).toBe(200);
    const finalRead = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}`,
      auth: buyer.auth,
    });
    const received = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/receive`,
      auth: buyer.auth,
      headers: { 'if-match': String(finalRead.body.version) },
    });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('DELIVERED');
  });
});
