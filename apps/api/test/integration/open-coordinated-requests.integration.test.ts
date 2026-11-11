import { Household, Product, QuotationRequest } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** BR-05a, ADR-0026: coordinated requests an administrator claimed are open to qualifying households. */
describe('open coordinated requests', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let admin: { auth: string };

  type Rep = { auth: string; householdId: string };
  let capable: Rep;
  let seller: Rep;
  let otherCraft: Rep;
  let noCapacity: Rep;
  let suspended: Rep;

  const day = 86_400_000;
  const completionDate = new Date(Date.now() + 10 * day).toISOString();
  const SECRET_TITLE = 'Confidential wedding gift order';

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
    return { auth: rep.auth, householdId: applied.body.id as string };
  };

  /** A coordinated request in `category`; `claim` makes an administrator claim it. */
  const send = async (options: {
    category?: string;
    invited?: string[];
    claim?: boolean;
    closesInDays?: number;
  }) => {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        title: SECRET_TITLE,
        category: options.category ?? 'TABLEWARE',
        design: 'Private design notes for the buyer',
        budgetMinVnd: 1_000_000,
        budgetMaxVnd: 2_000_000,
        quantity: 500,
        unit: 'cup',
        destination: 'Hanoi',
        requiredBy: new Date(Date.now() + 20 * day).toISOString(),
        biddingClosesAt: new Date(Date.now() + (options.closesInDays ?? 5) * day).toISOString(),
        invitedHouseholdIds: options.invited ?? [],
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
    let body = sent.body as { id: string; version: number };
    if (options.claim !== false) {
      const claimed = await t.request({
        method: 'POST',
        url: `/rfqs/${body.id}/coordinate`,
        auth: admin.auth,
        headers: { 'if-match': String(body.version) },
      });
      expect(claimed.status).toBe(200);
      body = claimed.body;
    }
    return body;
  };

  const open = (rep: Rep) =>
    t.request({ method: 'GET', url: '/me/open-coordinated-requests', auth: rep.auth });
  const ids = (res: { body: Array<{ id: string }> }) => res.body.map((row) => row.id);
  const offer = (requestId: string, rep: Rep, maxQuantity = 100) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/contributions`,
      auth: rep.auth,
      body: { maxQuantity, unitPriceVnd: 30_000, completionDate },
    });
  const expire = (id: string) =>
    db.orm.em
      .fork()
      .nativeUpdate(QuotationRequest, { id }, { biddingClosesAt: new Date(Date.now() - 1000) });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    capable = await household('open-capable', { TABLEWARE: 1000 });
    seller = await household('open-seller');
    otherCraft = await household('open-other-craft', { VASE: 500 });
    noCapacity = await household('open-no-capacity', { TABLEWARE: 0 });
    suspended = await household('open-suspended', { TABLEWARE: 1000 });
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: seller.auth,
      body: { name: 'Seller cup', category: 'TABLEWARE', priceVnd: 100_000, stock: 1 },
    });
    expect(created.status).toBe(201);
    await db.orm.em
      .fork()
      .nativeUpdate(
        Product,
        { id: created.body.id },
        { status: 'PUBLISHED', publishedAt: new Date() },
      );
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('lists a claimed coordinated request redacted for households that work in the category', async () => {
    const request = await send({});
    for (const rep of [capable, seller]) {
      const res = await open(rep);
      expect(res.status).toBe(200);
      expect(ids(res)).toContain(request.id);
      const row = res.body.find((entry: { id: string }) => entry.id === request.id);
      expect(Object.keys(row).sort()).toEqual([
        'biddingClosesAt',
        'category',
        'id',
        'quantity',
        'requiredBy',
        'unit',
      ]);
      expect(row).toMatchObject({ category: 'TABLEWARE', quantity: 500, unit: 'cup' });
    }
    const text = JSON.stringify((await open(capable)).body);
    expect(text).not.toContain(SECRET_TITLE);
    expect(text).not.toContain('Private design');
    expect(text).not.toContain('Hanoi');
    expect(text).not.toContain('1000000');
    expect(text).not.toContain('2000000');
  });

  it('leaves out requests of another category, without capacity, or of a suspended household', async () => {
    const request = await send({});
    expect(ids(await open(otherCraft))).not.toContain(request.id);
    expect(ids(await open(noCapacity))).not.toContain(request.id);
    await db.orm.em
      .fork()
      .nativeUpdate(Household, { id: suspended.householdId }, { status: 'SUSPENDED' });
    expect((await open(suspended)).body).toEqual([]);
    const refused = await offer(request.id, suspended);
    expect(refused.status).toBe(403);
    expect(refused.body.code).toBe('RFQ_ARTISAN_NOT_ELIGIBLE');
  });

  it('leaves out unclaimed requests, past deadlines and requests the household is invited to', async () => {
    const unclaimed = await send({ claim: false });
    const expired = await send({});
    await expire(expired.id);
    const invited = await send({ invited: [capable.householdId] });
    const res = await open(capable);
    expect(ids(res)).not.toContain(unclaimed.id);
    expect(ids(res)).not.toContain(expired.id);
    expect(ids(res)).not.toContain(invited.id);
    // The invited request is in the household's invitations instead.
    const mine = await t.request({ method: 'GET', url: '/me/invitations', auth: capable.auth });
    expect(mine.body.map((row: { request: { id: string } }) => row.request.id)).toContain(
      invited.id,
    );
  });

  it('lets an eligible household offer without an invitation and then treats it as invited', async () => {
    const request = await send({});
    const first = await offer(request.id, capable, 200);
    expect(first.status).toBe(201);
    const stored = await db.orm.em.fork().findOneOrFail(QuotationRequest, request.id);
    expect(stored.invitedHouseholdIds).toEqual([capable.householdId]);
    // It left the open list and is among the invitations now, with its offer.
    expect(ids(await open(capable))).not.toContain(request.id);
    const mine = await t.request({ method: 'GET', url: '/me/invitations', auth: capable.auth });
    const row = mine.body.find(
      (entry: { request: { id: string } }) => entry.request.id === request.id,
    );
    expect(row.contribution).toMatchObject({ maxQuantity: 200, status: 'ACTIVE' });
    // The administrator sees the self-offered household like an invited one.
    const coordination = await t.request({
      method: 'GET',
      url: `/rfqs/${request.id}/coordination`,
      auth: admin.auth,
    });
    expect(coordination.status).toBe(200);
    expect(
      coordination.body.contributions.map((c: { householdId: string }) => c.householdId),
    ).toEqual([capable.householdId]);
    // A second offer is refused as for any invited household and does not add the household twice.
    expect((await offer(request.id, capable, 150)).status).toBe(409);
    const again = await db.orm.em.fork().findOneOrFail(QuotationRequest, request.id);
    expect(again.invitedHouseholdIds).toEqual([capable.householdId]);
  });

  it('replays an identical offer with the same idempotency key', async () => {
    const request = await send({});
    const post = () =>
      t.request({
        method: 'POST',
        url: `/rfqs/${request.id}/contributions`,
        auth: seller.auth,
        headers: { 'idempotency-key': 'a3f1c2d4-5b6e-4f70-8a9b-0c1d2e3f4a5b' },
        body: { maxQuantity: 50, unitPriceVnd: 25_000, completionDate },
      });
    const first = await post();
    const second = await post();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    const stored = await db.orm.em.fork().findOneOrFail(QuotationRequest, request.id);
    expect(stored.invitedHouseholdIds).toEqual([seller.householdId]);
  });

  it('refuses an offer from an ineligible household and keeps invite-only requests hidden', async () => {
    const request = await send({});
    const wrongCraft = await offer(request.id, otherCraft);
    expect(wrongCraft.status).toBe(403);
    expect(wrongCraft.body.code).toBe('RFQ_ARTISAN_NOT_ELIGIBLE');
    expect((await offer(request.id, noCapacity)).status).toBe(403);
    const stored = await db.orm.em.fork().findOneOrFail(QuotationRequest, request.id);
    expect(stored.invitedHouseholdIds).toEqual([]);

    const unclaimed = await send({ claim: false });
    expect((await offer(unclaimed.id, capable)).status).toBe(404);

    const expired = await send({});
    await expire(expired.id);
    const late = await offer(expired.id, capable);
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('RFQ_BIDDING_CLOSED');
  });

  it('still applies the household capacity to the offered quantity', async () => {
    const request = await send({});
    const over = await offer(request.id, capable, 5000);
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('RFQ_CAPACITY_EXCEEDED');
    const stored = await db.orm.em.fork().findOneOrFail(QuotationRequest, request.id);
    expect(stored.invitedHouseholdIds).toEqual([]);
  });
});
