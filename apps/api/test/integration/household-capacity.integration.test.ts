import {
  AppUser,
  CooperativeQuotation,
  Household,
  OrderAllocation,
  QuotationNotice,
  QuotationRequest,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#247 (BR-L6, FR-ORD-09): a contribution, direct quotation, cooperative share or reallocated share
 * above the capacity a household declared for the request's category is refused with RFQ_CAPACITY_EXCEEDED.
 * Capacity is the per-category figure of the household profile (units per month); the model has no
 * reservation across concurrent orders, so only that figure is enforced.
 */
describe('household capacity enforcement', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string; id: string };
  let admin: { auth: string };
  let tight: Rep;
  let roomy: Rep;
  let free: Rep;

  type Rep = { auth: string; id: string; householdId: string };

  const day = 86_400_000;
  const completionDate = new Date(Date.now() + 10 * day).toISOString();

  const household = async (name: string, capacityByCategory?: Record<string, number>) => {
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
    if (capacityByCategory) {
      const patched = await t.request({
        method: 'PATCH',
        url: '/me/household',
        auth: rep.auth,
        headers: { 'if-match': String(approved.body.version) },
        body: { capacityByCategory },
      });
      expect(patched.status).toBe(200);
    }
    return { auth: rep.auth, id: rep.id, householdId: applied.body.id as string };
  };

  const send = async (invited: string[], coordinationOptIn: boolean, quantity: number) => {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        title: 'Logo cups',
        category: 'TABLEWARE',
        design: 'Cups with a printed logo',
        quantity,
        unit: 'cup',
        destination: 'Hanoi',
        requiredBy: new Date(Date.now() + 20 * day).toISOString(),
        biddingClosesAt: new Date(Date.now() + 5 * day).toISOString(),
        invitedHouseholdIds: invited,
        coordinationOptIn,
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
    return sent.body as { id: string; version: number };
  };

  const contribute = (requestId: string, rep: Rep, maxQuantity: number) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/contributions`,
      auth: rep.auth,
      body: { maxQuantity, unitPriceVnd: 30_000, completionDate },
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    tight = await household('capacity-tight', { TABLEWARE: 1000 });
    roomy = await household('capacity-roomy', { TABLEWARE: 2000 });
    free = await household('capacity-free');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('rejects a contribution above the declared capacity and accepts one at the capacity', async () => {
    const request = await send([tight.householdId, free.householdId], true, 5000);
    const over = await contribute(request.id, tight, 5000);
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('RFQ_CAPACITY_EXCEEDED');
    const exact = await contribute(request.id, tight, 1000);
    expect(exact.status).toBe(201);
    // A household that declared nothing for the category is not capped.
    expect((await contribute(request.id, free, 5000)).status).toBe(201);
  });

  it('rejects a revision that raises the offer above the declared capacity', async () => {
    const request = await send([tight.householdId], true, 5000);
    const created = await contribute(request.id, tight, 800);
    expect(created.status).toBe(201);
    const revised = await t.request({
      method: 'PUT',
      url: `/contributions/${created.body.id}`,
      auth: tight.auth,
      headers: { 'if-match': String(created.body.version) },
      body: { maxQuantity: 1001, unitPriceVnd: 30_000, completionDate },
    });
    expect(revised.status).toBe(422);
    expect(revised.body.code).toBe('RFQ_CAPACITY_EXCEEDED');
  });

  it('rejects a direct quotation for more than the declared capacity', async () => {
    const big = await send([tight.householdId, free.householdId], false, 1500);
    const over = await t.request({
      method: 'POST',
      url: `/rfqs/${big.id}/direct-quotations`,
      auth: tight.auth,
      body: { unitPriceVnd: 30_000, completionDate },
    });
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('RFQ_CAPACITY_EXCEEDED');
    // The household without a declared capacity can quote the whole quantity.
    const open = await t.request({
      method: 'POST',
      url: `/rfqs/${big.id}/direct-quotations`,
      auth: free.auth,
      body: { unitPriceVnd: 30_000, completionDate },
    });
    expect(open.status).toBe(201);
    const small = await send([tight.householdId], false, 900);
    const fits = await t.request({
      method: 'POST',
      url: `/rfqs/${small.id}/direct-quotations`,
      auth: tight.auth,
      body: { unitPriceVnd: 30_000, completionDate },
    });
    expect(fits.status).toBe(201);
  });

  it('rejects a cooperative share above the offered maximum and above a capacity lowered after the offer', async () => {
    const request = await send([roomy.householdId, free.householdId], true, 2400);
    const claimed = await t.request({
      method: 'POST',
      url: `/rfqs/${request.id}/coordinate`,
      auth: admin.auth,
      headers: { 'if-match': String(request.version) },
    });
    expect(claimed.status).toBe(200);
    const offerRoomy = await contribute(request.id, roomy, 2000);
    const offerFree = await contribute(request.id, free, 2000);
    expect(offerRoomy.status).toBe(201);
    expect(offerFree.status).toBe(201);

    const quote = async (roomyQuantity: number) => {
      const current = await t.request({
        method: 'GET',
        url: `/rfqs/${request.id}`,
        auth: buyer.auth,
      });
      const parts = [
        { rep: roomy, offer: offerRoomy.body, quantity: roomyQuantity },
        { rep: free, offer: offerFree.body, quantity: 2400 - roomyQuantity },
      ].map(({ rep, offer, quantity }) => ({
        householdId: rep.householdId,
        quantity,
        unitPriceVnd: offer.unitPriceVnd,
        completionDate: offer.completionDate,
        contributionVersion: offer.version,
      }));
      return t.request({
        method: 'POST',
        url: `/rfqs/${request.id}/quotations`,
        auth: admin.auth,
        headers: { 'if-match': String(current.body.version) },
        body: { parts, additionalChargeVnd: 0, deliveryTerms: 'SEPARATE' },
      });
    };

    // Above the offered maximum: a named error code instead of a generic conflict.
    const aboveOffer = await quote(2001);
    expect(aboveOffer.status).toBe(409);
    expect(aboveOffer.body.code).toBe('RFQ_OFFER_QUANTITY_EXCEEDED');

    // The household lowers its declared capacity after offering 2000: the share of 1500 no longer fits.
    const em = db.orm.em.fork();
    const row = await em.findOneOrFail(Household, roomy.householdId);
    row.capacityByCategory = { TABLEWARE: 1200 };
    await em.flush();
    const aboveCapacity = await quote(1500);
    expect(aboveCapacity.status).toBe(422);
    expect(aboveCapacity.body.code).toBe('RFQ_CAPACITY_EXCEEDED');
    const within = await quote(1200);
    expect(within.status).toBe(201);

    // The coordination view tells the split board each household's declared capacity.
    const coordination = await t.request({
      method: 'GET',
      url: `/rfqs/${request.id}/coordination`,
      auth: admin.auth,
    });
    expect(coordination.status).toBe(200);
    const capacities = Object.fromEntries(
      coordination.body.contributions.map(
        (c: { householdId: string; householdCapacity: number | null }) => [
          c.householdId,
          c.householdCapacity,
        ],
      ),
    );
    expect(capacities).toEqual({ [roomy.householdId]: 1200, [free.householdId]: null });
  });

  it('refuses a reallocation that raises a share above the household capacity', async () => {
    const em = db.orm.em.fork();
    const now = Date.now();
    const [source, target] = await Promise.all([
      em.findOneOrFail(Household, free.householdId),
      em.findOneOrFail(Household, tight.householdId),
    ]);
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      design: 'Reallocated cups',
      category: 'TABLEWARE',
      quantity: 1500,
      unit: 'cup',
      destination: 'Hanoi',
      requiredBy: new Date(now + 20 * day),
      biddingClosesAt: new Date(now - 10 * day),
      invitedHouseholdIds: [source.id, target.id],
      status: 'IN_PRODUCTION',
    });
    const quotation = em.create(CooperativeQuotation, {
      request,
      status: 'ACCEPTED',
      quantity: 1500,
      parts: [
        {
          householdId: source.id,
          quantity: 700,
          unitPriceVnd: 30_000,
          completionDate: new Date(now - day).toISOString(),
          contributionVersion: 1,
        },
        {
          householdId: target.id,
          quantity: 800,
          unitPriceVnd: 30_000,
          completionDate: new Date(now + 10 * day).toISOString(),
          contributionVersion: 1,
        },
      ],
      productionTotalVnd: 45_000_000,
      totalVnd: 45_000_000,
      deliveryTerms: 'INCLUDED',
    });
    const late = em.create(OrderAllocation, {
      quotation,
      household: source,
      quantity: 700,
      completedQty: 100,
      status: 'IN_PROGRESS',
    });
    em.create(OrderAllocation, {
      quotation,
      household: target,
      quantity: 800,
      completedQty: 0,
      status: 'IN_PROGRESS',
    });
    await em.flush();

    const reallocate = (quantity: number) =>
      t.request({
        method: 'POST',
        url: `/admin/allocations/${late.id}/reallocate`,
        auth: admin.auth,
        headers: { 'if-match': `"${late.version}"` },
        body: { targets: [{ householdId: target.id, quantity }] },
      });
    // 600 pieces are left on the late share: the target would go from 800 to 1400, above its 1000.
    const over = await reallocate(600);
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('RFQ_CAPACITY_EXCEEDED');

    // Within capacity (800 + 200 = 1000, and 400 for a household with room) it goes through, and the
    // late household is told that the rest of its share moved.
    const ok = await t.request({
      method: 'POST',
      url: `/admin/allocations/${late.id}/reallocate`,
      auth: admin.auth,
      headers: { 'if-match': `"${late.version}"` },
      body: {
        targets: [
          { householdId: target.id, quantity: 200 },
          { householdId: roomy.householdId, quantity: 400 },
        ],
      },
    });
    expect(ok.status).toBe(200);
    const notices = await db.orm.em.fork().find(QuotationNotice, { requestId: request.id });
    const kindsFor = (recipientId: string) =>
      notices.filter((n) => n.recipientId === recipientId).map((n) => n.kind);
    expect(kindsFor(free.id)).toEqual(['ALLOCATION_REASSIGNED']);
    expect(kindsFor(tight.id)).toEqual(['ALLOCATION_PROPOSED']);
    expect(kindsFor(roomy.id)).toEqual(['ALLOCATION_PROPOSED']);
  });
});
