import {
  AppUser,
  CooperativeQuotation,
  Household,
  OrderAllocation,
  QuotationRequest,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#425: orders that could get stuck. Cancelling an order with finished shares, and starting or receiving
 * a direct order that a reallocation split between households (nobody coordinates it, so the board acts).
 */
describe('Stuck orders', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let buyer: { id: string; auth: string };
  let households: Household[];
  const DAY = 86_400_000;

  type Share = { household: number; status: OrderAllocation['status']; quantity?: number };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    for (const name of ['a', 'b']) {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: `Stuck ${name}`, slug: `stuck-${name}`, history: '' },
      });
      await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
    }
    households = await db.orm.em
      .fork()
      .find(Household, { slug: { $like: 'stuck-%' } }, { orderBy: { slug: 'asc' } });
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  /** An accepted order set up directly, with one allocation per entry of `shares`. */
  const order = async (
    status: 'ACCEPTED' | 'IN_PRODUCTION',
    shares: Share[],
    coordinated = false,
  ) => {
    const em = db.orm.em.fork();
    const now = Date.now();
    const request = em.create(QuotationRequest, {
      buyer: em.getReference(AppUser, buyer.id),
      design: 'Cups',
      quantity: 100 * shares.length,
      unit: 'cup',
      destination: 'Hanoi',
      requiredBy: new Date(now + 20 * DAY),
      biddingClosesAt: new Date(now - 10 * DAY),
      invitedHouseholdIds: households.map((h) => h.id),
      status,
      ...(coordinated ? { coordinationOptIn: true, coordinatorId: admin.id } : {}),
    });
    const quotation = em.create(CooperativeQuotation, {
      request,
      status: 'ACCEPTED',
      quantity: 100 * shares.length,
      parts: shares.map((share) => ({
        householdId: (households[share.household] as Household).id,
        quantity: share.quantity ?? 100,
        unitPriceVnd: 40_000,
        completionDate: new Date(now + 10 * DAY).toISOString(),
        contributionVersion: 1,
      })),
      productionTotalVnd: 4_000_000 * shares.length,
      totalVnd: 4_000_000 * shares.length,
      deliveryTerms: 'INCLUDED',
    });
    for (const share of shares) {
      const quantity = share.quantity ?? 100;
      em.create(OrderAllocation, {
        quotation,
        household: households[share.household] as Household,
        quantity,
        completedQty: share.status === 'DONE' ? quantity : 0,
        status: share.status,
      });
    }
    await em.flush();
    return request.id;
  };

  const act = async (id: string, action: string, auth: string, body?: object) => {
    const row = await db.orm.em.fork().findOneOrFail(QuotationRequest, id);
    return t.request({
      method: 'POST',
      url: `/rfqs/${id}/${action}`,
      auth,
      headers: { 'if-match': String(row.version) },
      body,
    });
  };

  const shareStatuses = async (id: string) => {
    const rows = await db.orm.em
      .fork()
      .find(OrderAllocation, { quotation: { request: id } }, { populate: ['household'] });
    return rows
      .sort((x, y) => x.household.slug.localeCompare(y.household.slug))
      .map((row) => row.status);
  };

  it('cancels an in-production order and keeps the finished shares DONE', async () => {
    const id = await order('IN_PRODUCTION', [
      { household: 0, status: 'DONE' },
      { household: 1, status: 'IN_PROGRESS' },
    ]);
    const res = await act(id, 'cancel', admin.auth, { reason: 'The buyer left' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(await shareStatuses(id)).toEqual(['DONE', 'CANCELLED']);
  });

  it('lets the board start production of a direct order a reallocation split', async () => {
    const id = await order('ACCEPTED', [
      { household: 0, status: 'CONFIRMED' },
      { household: 1, status: 'CONFIRMED' },
    ]);
    const res = await act(id, 'start-production', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PRODUCTION');
    expect(await shareStatuses(id)).toEqual(['IN_PROGRESS', 'IN_PROGRESS']);
  });

  it('keeps the board out of a direct order that was never split', async () => {
    const id = await order('ACCEPTED', [{ household: 0, status: 'CONFIRMED' }]);
    expect((await act(id, 'start-production', admin.auth)).status).toBe(404);
  });

  it('still reserves a coordinated order for its coordinator when starting production', async () => {
    const other = await t.createUser('ADMIN');
    const id = await order(
      'ACCEPTED',
      [
        { household: 0, status: 'CONFIRMED' },
        { household: 1, status: 'CONFIRMED' },
      ],
      true,
    );
    expect((await act(id, 'start-production', other.auth)).status).toBe(404);
    expect((await act(id, 'start-production', admin.auth)).status).toBe(200);
  });

  it('lets the board confirm receipt of a direct order a reallocation split', async () => {
    const id = await order('IN_PRODUCTION', [
      { household: 0, status: 'DONE' },
      { household: 1, status: 'DONE' },
    ]);
    const res = await act(id, 'receive', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DELIVERED');
  });

  it('keeps the board out of confirming receipt of a direct order that was never split', async () => {
    const id = await order('IN_PRODUCTION', [{ household: 0, status: 'DONE' }]);
    expect((await act(id, 'receive', admin.auth)).status).toBe(404);
  });

  it('still reserves receipt of a coordinated order for its coordinator', async () => {
    const other = await t.createUser('ADMIN');
    const id = await order(
      'IN_PRODUCTION',
      [
        { household: 0, status: 'DONE' },
        { household: 1, status: 'DONE' },
      ],
      true,
    );
    expect((await act(id, 'receive', other.auth)).status).toBe(404);
    expect((await act(id, 'receive', admin.auth)).status).toBe(200);
  });
});
