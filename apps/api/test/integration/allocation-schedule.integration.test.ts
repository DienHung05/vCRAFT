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
 * Issue #91 (PLAN E10, FR-ORD-09): the admin allocation timeline and reallocating the unfinished part of
 * a late share. The order is set up directly in production; the endpoints are exercised over HTTP.
 */
describe('Allocation timeline and reallocation', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let households: Household[];
  let late: OrderAllocation;
  let quotationId: string;
  const DAY = 86_400_000;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    const buyer = await t.createUser('BUYER');
    households = [];
    for (const name of ['a', 'b', 'c']) {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: `Gantt ${name}`, slug: `gantt-${name}`, history: '' },
      });
      await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
    }
    const em = db.orm.em.fork();
    households = await em.find(
      Household,
      { slug: { $like: 'gantt-%' } },
      { orderBy: { slug: 'asc' } },
    );
    const [a, b] = households as [Household, Household, Household];
    const now = Date.now();
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      design: 'Cốc men lam',
      quantity: 1000,
      unit: 'cốc',
      destination: 'Hà Nội',
      requiredBy: new Date(now + 20 * DAY),
      biddingClosesAt: new Date(now - 10 * DAY),
      invitedHouseholdIds: [a.id, b.id],
      status: 'IN_PRODUCTION',
    });
    const quotation = em.create(CooperativeQuotation, {
      request,
      status: 'ACCEPTED',
      quantity: 1000,
      parts: [
        // Household a promised day -1: it is overdue with pieces left.
        {
          householdId: a.id,
          quantity: 600,
          unitPriceVnd: 40_000,
          completionDate: new Date(now - DAY).toISOString(),
          contributionVersion: 1,
        },
        {
          householdId: b.id,
          quantity: 400,
          unitPriceVnd: 42_000,
          completionDate: new Date(now + 10 * DAY).toISOString(),
          contributionVersion: 1,
        },
      ],
      productionTotalVnd: 40_800_000,
      totalVnd: 40_800_000,
      deliveryTerms: 'INCLUDED',
    });
    quotationId = quotation.id;
    late = em.create(OrderAllocation, {
      quotation,
      household: a,
      quantity: 600,
      completedQty: 200,
      status: 'IN_PROGRESS',
    });
    em.create(OrderAllocation, {
      quotation,
      household: b,
      quantity: 400,
      completedQty: 100,
      status: 'IN_PROGRESS',
    });
    await em.flush();
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('lists running orders with each share, its due date and lateness', async () => {
    const res = await t.request({ method: 'GET', url: '/admin/allocations', auth: admin.auth });
    expect(res.status).toBe(200);
    const order = res.body[0];
    expect(order.allocations).toHaveLength(2);
    const a = order.allocations.find((x: { id: string }) => x.id === late.id);
    expect(a).toMatchObject({ quantity: 600, completedQty: 200, lateness: 'OVERDUE' });
  });

  it('refuses targets that do not cover the remaining quantity', async () => {
    const res = await t.request({
      method: 'POST',
      url: `/admin/allocations/${late.id}/reallocate`,
      auth: admin.auth,
      headers: { 'if-match': `"${late.version}"` },
      body: { targets: [{ householdId: households[2]?.id, quantity: 100 }] },
    });
    expect(res.status).toBe(422);
  });

  it('moves the unfinished pieces and keeps the order total', async () => {
    const [, b, c] = households as [Household, Household, Household];
    const res = await t.request({
      method: 'POST',
      url: `/admin/allocations/${late.id}/reallocate`,
      auth: admin.auth,
      headers: { 'if-match': `"${late.version}"` },
      body: {
        targets: [
          { householdId: b.id, quantity: 150 },
          { householdId: c.id, quantity: 250 },
        ],
      },
    });
    expect(res.status).toBe(200);

    const rows = await db.orm.em
      .fork()
      .find(OrderAllocation, { quotation: quotationId }, { populate: ['household'] });
    const of = (h: Household) => rows.find((r) => r.household.id === h.id);
    expect(of(households[0] as Household)).toMatchObject({ quantity: 200, status: 'DONE' });
    expect(of(b)?.quantity).toBe(550);
    expect(of(c)).toMatchObject({ quantity: 250, status: 'IN_PROGRESS' });
    const active = rows.filter((r) => r.status !== 'CANCELLED');
    expect(active.reduce((sum, r) => sum + r.quantity, 0)).toBe(1000);

    const quotation = await db.orm.em.fork().findOneOrFail(CooperativeQuotation, quotationId);
    expect(quotation.parts.map((p) => p.householdId)).toContain(c.id);
    const notices = await db.orm.em.fork().find(QuotationNotice, { kind: 'ALLOCATION_PROPOSED' });
    expect(notices).toHaveLength(2);
  });

  it('is for administrators only', async () => {
    const buyer = await t.createUser('BUYER');
    expect(
      (await t.request({ method: 'GET', url: '/admin/allocations', auth: buyer.auth })).status,
    ).toBe(403);
  });
});
