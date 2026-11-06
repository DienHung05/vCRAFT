import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #90: `GET /rfqs/:id/price-hint` gives an invited household a unit price range from its own
 * earlier offers and comparable public products, and never from another household's sealed offer.
 */
describe('Suggested price on the bid form', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let reps: Array<{ auth: string; householdId: string }>;
  const deadline = new Date(Date.now() + 86_400_000).toISOString();
  const completionDate = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const requiredBy = new Date(Date.now() + 20 * 86_400_000).toISOString();

  const rep = (index: number) => {
    const found = reps[index];
    if (!found) throw new Error(`missing representative ${index}`);
    return found;
  };

  async function sentRequest(invited: number[]) {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        design: 'Logo cups',
        category: 'TABLEWARE',
        quantity: 1000,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy,
        biddingClosesAt: deadline,
        invitedHouseholdIds: invited.map((i) => rep(i).householdId),
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
    return sent.body.id as string;
  }

  const offer = (requestId: string, index: number, unitPriceVnd: number) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/contributions`,
      auth: rep(index).auth,
      body: { maxQuantity: 500, unitPriceVnd, completionDate },
    });

  const hint = (requestId: string, auth: string) =>
    t.request({ method: 'GET', url: `/rfqs/${requestId}/price-hint`, auth });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    const admin = await t.createUser('ADMIN');
    reps = [];
    for (const name of ['a', 'b', 'c']) {
      const user = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hint ${name}`, slug: `hint-household-${name}`, history: '' },
      });
      await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
      reps.push({ auth: user.auth, householdId: applied.body.id });
    }
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('is null with no history and no comparable listings', async () => {
    const requestId = await sentRequest([0, 1]);
    const res = await hint(requestId, rep(0).auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hint: null });
  });

  it('uses the household’s own earlier offers, not another household’s', async () => {
    for (const price of [40_000, 50_000, 60_000]) {
      const earlier = await sentRequest([0, 1]);
      expect((await offer(earlier, 0, price)).status).toBe(201);
      // Household b bids far higher on the same requests; its sealed prices must not move a's range.
      expect((await offer(earlier, 1, price * 10)).status).toBe(201);
    }
    const current = await sentRequest([0, 1]);
    const res = await hint(current, rep(0).auth);
    expect(res.status).toBe(200);
    expect(res.body.hint).toEqual({
      minVnd: 45_000,
      maxVnd: 55_000,
      basis: 'OWN',
      ownSamples: 3,
      catalogSamples: 0,
    });
  });

  it('is only for invited households', async () => {
    const requestId = await sentRequest([0]);
    expect((await hint(requestId, rep(2).auth)).status).toBe(404);
    expect((await hint(requestId, buyer.auth)).status).toBe(403);
  });
});
