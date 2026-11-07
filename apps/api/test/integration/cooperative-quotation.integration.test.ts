import { BuyerQuotationResponseSchema } from '@vcraft/contracts';
import { RFQ_ACCEPT_GRACE_MS } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

describe('private contributions and cooperative quotations', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let stranger: { auth: string };
  let admin: { auth: string };
  let otherAdmin: { auth: string };
  let reps: Array<{ auth: string; householdId: string }>;
  let requestId: string;
  // At least 24 h away when submitted (SRS T1, GH#244).
  const deadline = new Date(Date.now() + 2 * 86_400_000).toISOString();
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
    otherAdmin = await t.createUser('ADMIN');
    reps = [];
    for (const name of ['a', 'b', 'c']) {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: `Household ${name}`, slug: `quotation-household-${name}`, history: '' },
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
        quantity: 5000,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy,
        biddingClosesAt: deadline,
        invitedHouseholdIds: reps.slice(0, 2).map((rep) => rep.householdId),
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
    return sent.body;
  }

  async function currentRequest() {
    const read = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: buyer.auth });
    expect(read.status).toBe(200);
    return read.body;
  }

  async function quote(body: unknown) {
    const request = await currentRequest();
    return t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/quotations`,
      auth: admin.auth,
      headers: { 'if-match': String(request.version) },
      body,
    });
  }

  async function plan() {
    const read = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: admin.auth,
    });
    expect(read.status).toBe(200);
    return {
      parts: read.body.map(
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
      additionalChargeVnd: 1_000_000,
      deliveryTerms: 'SEPARATE',
    };
  }

  it('persists a request, assigns one coordinator and keeps it private', async () => {
    const request = await freshRequest();
    requestId = request.id;
    expect((await t.request({ method: 'GET', url: `/rfqs/${requestId}` })).status).toBe(401);
    expect(
      (await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: stranger.auth })).status,
    ).toBe(404);
    expect(
      (await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: representative(2).auth }))
        .status,
    ).toBe(404);
    const assigned = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/coordinate`,
      auth: admin.auth,
      headers: { 'if-match': String(request.version) },
    });
    expect(assigned.status).toBe(200);
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${requestId}/contributions`,
          auth: otherAdmin.auth,
        })
      ).status,
    ).toBe(404);
    const invited = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/invitations`,
      auth: admin.auth,
      headers: { 'if-match': String(assigned.body.version) },
      body: { householdIds: [representative(2).householdId] },
    });
    expect(invited.status).toBe(200);
  });

  it('saves per-request offers without publishing contributions to the buyer or peers', async () => {
    for (const [index, rep] of reps.entries()) {
      const created = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/contributions`,
        auth: rep.auth,
        body: {
          maxQuantity: index === 0 ? 2000 : 1500,
          unitPriceVnd: 30_000 + index * 2000,
          completionDate,
        },
      });
      expect(created.status).toBe(201);
    }
    expect((await currentRequest()).status).toBe('SENT');
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: representative(0).auth,
    });
    expect(own.body).toHaveLength(1);
    expect(own.body[0].householdId).toBe(representative(0).householdId);
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${requestId}/contributions`,
          auth: buyer.auth,
        })
      ).status,
    ).toBe(403);
    const another = await freshRequest();
    expect(
      (
        await t.request({
          method: 'POST',
          url: `/rfqs/${another.id}/contributions`,
          auth: representative(0).auth,
          body: { maxQuantity: 2000, unitPriceVnd: 30_000, completionDate },
        })
      ).status,
    ).toBe(201);
  });

  it('rejects inadequate, over-limit, rewritten and duplicate household shares', async () => {
    const draft = await plan();
    const short = await quote({ ...draft, parts: draft.parts.slice(0, 2) });
    expect(short.status).toBe(409);
    for (const replacement of [
      { quantity: 2100 },
      { unitPriceVnd: 1 },
      { completionDate: requiredBy },
      { contributionVersion: 999 },
    ]) {
      const bad = await quote({
        ...draft,
        parts: draft.parts.map((part: object, index: number) =>
          index === 0 ? { ...part, ...replacement } : part,
        ),
      });
      expect(bad.status).toBe(409);
    }
    const duplicate = await quote({ ...draft, parts: [draft.parts[0], draft.parts[0]] });
    expect(duplicate.status).toBe(409);
  });

  it('publishes a complete cooperative quote while keeping household prices out of the buyer response', async () => {
    const created = await quote(await plan());
    expect(created.status).toBe(201);
    expect(created.body.productionTotalVnd).toBe(159_000_000);
    expect((await currentRequest()).status).toBe('BIDDING');
    const read = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: buyer.auth,
    });
    expect(read.status).toBe(200);
    expect(read.body).toHaveLength(1);
    expect(BuyerQuotationResponseSchema.safeParse(read.body[0]).success).toBe(true);
    expect(read.body[0].totalVnd).toBe(160_000_000);
    for (const part of read.body[0].parts) expect(part).not.toHaveProperty('unitPriceVnd');
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${requestId}/quotations`,
          auth: stranger.auth,
        })
      ).status,
    ).toBe(404);
  });

  it('rejects stale writes and withdraws dependent quotes when an input changes', async () => {
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: representative(0).auth,
    });
    const offer = own.body[0];
    const updated = await t.request({
      method: 'PUT',
      url: `/contributions/${offer.id}`,
      auth: representative(0).auth,
      headers: { 'if-match': String(offer.version) },
      body: { maxQuantity: 2000, unitPriceVnd: 31_000, completionDate },
    });
    expect(updated.status).toBe(200);
    const stale = await t.request({
      method: 'PUT',
      url: `/contributions/${offer.id}`,
      auth: representative(0).auth,
      headers: { 'if-match': String(offer.version) },
      body: { maxQuantity: 2000, unitPriceVnd: 32_000, completionDate },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
    const buyerRead = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: buyer.auth,
    });
    expect(buyerRead.body[0].status).toBe('WITHDRAWN');
    for (const recipient of [buyer, admin]) {
      const notices = await t.request({
        method: 'GET',
        url: '/me/quotation-notices',
        auth: recipient.auth,
      });
      expect(notices.status).toBe(200);
      expect(notices.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            requestId,
            kind: 'QUOTATION_WITHDRAWN',
          }),
        ]),
      );
    }
    const unrelated = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: stranger.auth,
    });
    expect(unrelated.body).toEqual([]);
    const history = await t.request({
      method: 'GET',
      url: `/contributions/${offer.id}/history`,
      auth: representative(0).auth,
    });
    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(2);
    expect(history.body[0].unitPriceVnd).toBe(30_000);
    expect(history.body[1].unitPriceVnd).toBe(31_000);
    const replacement = await quote(await plan());
    expect(replacement.status).toBe(201);
    const withdrawn = await t.request({
      method: 'POST',
      url: `/contributions/${offer.id}/withdraw`,
      auth: representative(0).auth,
      headers: { 'if-match': String(updated.body.version) },
    });
    expect(withdrawn.status).toBe(200);
    const after = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: buyer.auth,
    });
    expect(
      after.body.every((quotation: { status: string }) => quotation.status === 'WITHDRAWN'),
    ).toBe(true);
  });

  it('serializes composition against a racing contribution update', async () => {
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: representative(0).auth,
    });
    const current = own.body[0];
    const restored = await t.request({
      method: 'PUT',
      url: `/contributions/${current.id}`,
      auth: representative(0).auth,
      headers: { 'if-match': String(current.version) },
      body: { maxQuantity: 2000, unitPriceVnd: 31_000, completionDate },
    });
    expect(restored.status).toBe(200);
    const draft = await plan();
    const request = await currentRequest();
    const [composed, edited] = await Promise.all([
      t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/quotations`,
        auth: admin.auth,
        headers: { 'if-match': String(request.version) },
        body: draft,
      }),
      t.request({
        method: 'PUT',
        url: `/contributions/${current.id}`,
        auth: representative(0).auth,
        headers: { 'if-match': String(restored.body.version) },
        body: { maxQuantity: 2000, unitPriceVnd: 33_000, completionDate },
      }),
    ]);
    expect([201, 409]).toContain(composed.status);
    expect(edited.status).toBe(200);
    const read = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: buyer.auth,
    });
    expect(
      read.body.every((quotation: { status: string }) => quotation.status === 'WITHDRAWN'),
    ).toBe(true);
  });

  it('closes bidding at the deadline and expires after the accept window without an expiry worker (T8)', async () => {
    const created = await quote(await plan());
    expect(created.status).toBe(201);
    const statusOf = async () => {
      const read = await t.request({
        method: 'GET',
        url: `/rfqs/${requestId}/quotations`,
        auth: buyer.auth,
      });
      return read.body.find((quotation: { id: string }) => quotation.id === created.body.id)
        .status as string;
    };
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      // At the deadline no new quote is taken, but the buyer still has 7 days to accept (GH#244).
      vi.setSystemTime(new Date(deadline));
      expect((await currentRequest()).status).toBe('BIDDING');
      expect(await statusOf()).toBe('SUBMITTED');
      expect((await quote(await plan())).status).toBe(409);

      vi.setSystemTime(new Date(new Date(deadline).getTime() + RFQ_ACCEPT_GRACE_MS));
      expect((await currentRequest()).status).toBe('EXPIRED');
      expect(await statusOf()).toBe('LAPSED');
    } finally {
      vi.useRealTimers();
    }
  });
});
