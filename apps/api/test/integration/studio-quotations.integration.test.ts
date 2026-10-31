import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Issue #33: a household's invitations and allocations, with sealed bidding between households. */
describe('Studio invitations and allocations', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let admin: { auth: string };
  let repA: { auth: string };
  let repB: { auth: string };
  let repC: { auth: string };
  let idA: string;
  let idB: string;
  let requestId: string;

  const day = 86_400_000;
  const PRICE_A = 11_111;
  const PRICE_B = 22_222;
  const completionDate = new Date(Date.now() + 10 * day).toISOString();

  const household = async (auth: string, name: string) => {
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth,
      body: { name, slug: name, history: '' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
    return applied.body.id as string;
  };
  const send = async (invited: string[], title: string, closesInDays = 5) => {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        title,
        design: `${title} description`,
        quantity: 100,
        unit: 'cup',
        destination: 'Hanoi',
        requiredBy: new Date(Date.now() + 20 * day).toISOString(),
        biddingClosesAt: new Date(Date.now() + closesInDays * day).toISOString(),
        invitedHouseholdIds: invited,
        coordinationOptIn: true,
      },
    });
    const sent = await t.request({
      method: 'POST',
      url: `/rfqs/${created.body.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': `"${created.body.version}"` },
    });
    expect(sent.status).toBe(200);
    return sent.body;
  };
  const offer = (id: string, auth: string, unitPriceVnd: number) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${id}/contributions`,
      auth,
      body: { maxQuantity: 100, unitPriceVnd, completionDate },
    });
  const invitations = (auth: string) => t.request({ method: 'GET', url: '/me/invitations', auth });
  const allocations = (auth: string) => t.request({ method: 'GET', url: '/me/allocations', auth });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    repA = await t.createUser('BUYER');
    repB = await t.createUser('BUYER');
    repC = await t.createUser('BUYER');
    idA = await household(repA.auth, 'studio-household-a');
    idB = await household(repB.auth, 'studio-household-b');
    await household(repC.auth, 'studio-household-c');
    requestId = (await send([idA, idB], 'Shared request')).id;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('is for household representatives only', async () => {
    expect((await invitations(buyer.auth)).status).toBe(403);
    expect((await allocations(admin.auth)).status).toBe(403);
  });

  it('lists only requests the household was invited to', async () => {
    const { status, body } = await invitations(repC.auth);
    expect(status).toBe(200);
    expect(body).toEqual([]);
    const mine = await invitations(repA.auth);
    expect(mine.body.map((row: { request: { id: string } }) => row.request.id)).toEqual([
      requestId,
    ]);
    expect(mine.body[0]).toMatchObject({ contribution: null, declined: false });
  });

  it('keeps bidding sealed: a household sees only its own price and not who else was invited', async () => {
    expect((await offer(requestId, repA.auth, PRICE_A)).status).toBe(201);
    expect((await offer(requestId, repB.auth, PRICE_B)).status).toBe(201);
    const mine = await invitations(repA.auth);
    const text = JSON.stringify(mine.body);
    expect(mine.body[0].contribution.unitPriceVnd).toBe(PRICE_A);
    expect(mine.body[0].request.invitedHouseholdIds).toEqual([idA]);
    expect(text).not.toContain(String(PRICE_B));
    expect(text).not.toContain(idB);

    const direct = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: repA.auth,
    });
    expect(JSON.stringify(direct.body)).not.toContain(String(PRICE_B));
    const coordination = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/coordination`,
      auth: repA.auth,
    });
    expect(coordination.status).toBe(403);
    const quotations = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/quotations`,
      auth: repA.auth,
    });
    expect(quotations.status).toBe(403);
    const uninvited = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/contributions`,
      auth: repC.auth,
    });
    expect(uninvited.status).toBe(404);
  });

  it('lets an invited household decline, then change its mind before the deadline', async () => {
    const request = await send([idA, idB], 'Declined request');
    const decline = (auth: string) =>
      t.request({ method: 'POST', url: `/rfqs/${request.id}/decline`, auth });
    expect((await decline(repC.auth)).status).toBe(404);
    expect((await decline(buyer.auth)).status).toBe(403);
    const declined = await decline(repA.auth);
    expect(declined.status).toBe(200);
    expect(declined.body.declinedByMe).toBe(true);

    const row = (await invitations(repA.auth)).body.find(
      (item: { request: { id: string } }) => item.request.id === request.id,
    );
    expect(row.declined).toBe(true);
    const other = (await invitations(repB.auth)).body.find(
      (item: { request: { id: string } }) => item.request.id === request.id,
    );
    expect(other.declined).toBe(false);
    const buyerView = await t.request({
      method: 'GET',
      url: `/rfqs/${request.id}`,
      auth: buyer.auth,
    });
    expect(JSON.stringify(buyerView.body)).not.toContain('declined');

    expect((await offer(request.id, repA.auth, 15_000)).status).toBe(201);
    const after = await t.request({ method: 'GET', url: `/rfqs/${request.id}`, auth: repA.auth });
    expect(after.body.declinedByMe).toBe(false);
    expect((await decline(repA.auth)).status).toBe(409);
  });

  describe('after the buyer accepts', () => {
    let allocation: { id: string; version: number };

    beforeAll(async () => {
      const current = await t.request({
        method: 'GET',
        url: `/rfqs/${requestId}`,
        auth: admin.auth,
      });
      const claimed = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/coordinate`,
        auth: admin.auth,
        headers: { 'if-match': `"${current.body.version}"` },
      });
      const view = await t.request({
        method: 'GET',
        url: `/rfqs/${requestId}/coordination`,
        auth: admin.auth,
      });
      expect(claimed.status).toBe(200);
      const a = view.body.contributions.find(
        (item: { householdId: string }) => item.householdId === idA,
      );
      const made = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/quotations`,
        auth: admin.auth,
        headers: { 'if-match': `"${view.body.request.version}"` },
        body: {
          parts: [
            {
              householdId: idA,
              quantity: 100,
              unitPriceVnd: a.unitPriceVnd,
              completionDate: a.completionDate,
              contributionVersion: a.version,
            },
          ],
          additionalChargeVnd: 0,
          deliveryTerms: 'INCLUDED',
        },
      });
      expect(made.status).toBe(201);
      const fresh = await t.request({ method: 'GET', url: `/rfqs/${requestId}`, auth: buyer.auth });
      const accepted = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/accept`,
        auth: buyer.auth,
        headers: { 'if-match': `"${fresh.body.version}"` },
        body: { quotationId: made.body.id },
      });
      expect(accepted.status).toBe(200);
    });

    it('lists the allocation for its household only, with the order details', async () => {
      const mine = await allocations(repA.auth);
      expect(mine.status).toBe(200);
      expect(mine.body).toHaveLength(1);
      expect(mine.body[0]).toMatchObject({
        requestId,
        requestTitle: 'Shared request',
        requestStatus: 'ACCEPTED',
        status: 'PROPOSED',
        quantity: 100,
        unit: 'cup',
        progressLog: [],
      });
      expect(mine.body[0].completionDate).toBeTruthy();
      allocation = mine.body[0];
      expect((await allocations(repB.auth)).body).toEqual([]);
    });

    it('confirms, then records quantity and a note in the log', async () => {
      const confirmed = await t.request({
        method: 'POST',
        url: `/allocations/${allocation.id}/confirm`,
        auth: repA.auth,
        headers: { 'if-match': `"${allocation.version}"` },
      });
      expect(confirmed.status).toBe(200);
      const request = await t.request({
        method: 'GET',
        url: `/rfqs/${requestId}`,
        auth: admin.auth,
      });
      const started = await t.request({
        method: 'POST',
        url: `/rfqs/${requestId}/start-production`,
        auth: admin.auth,
        headers: { 'if-match': `"${request.body.version}"` },
      });
      expect(started.status).toBe(200);
      const current = (await allocations(repA.auth)).body[0];
      const reported = await t.request({
        method: 'POST',
        url: `/allocations/${current.id}/progress`,
        auth: repA.auth,
        headers: { 'if-match': `"${current.version}"` },
        body: { completedQty: 40, note: 'First firing done' },
      });
      expect(reported.status).toBe(200);
      expect(reported.body.progressLog).toHaveLength(1);
      expect(reported.body.progressLog[0]).toMatchObject({
        completedQty: 40,
        note: 'First firing done',
        photoUrl: null,
      });
    });

    it('refuses a photo the representative does not own', async () => {
      const current = (await allocations(repA.auth)).body[0];
      const reported = await t.request({
        method: 'POST',
        url: `/allocations/${current.id}/progress`,
        auth: repA.auth,
        headers: { 'if-match': `"${current.version}"` },
        body: { completedQty: 50, photoMediaId: '00000000-0000-4000-8000-000000000000' },
      });
      expect(reported.status).toBe(422);
    });
  });
});
