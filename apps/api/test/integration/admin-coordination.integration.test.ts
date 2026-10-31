import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Issue #36: coordination queue with one admin per request, and the audit log screen's API. */
describe('Admin coordination queue and audit log', () => {
  let db: TestDatabase;
  let t: TestApp;
  let adminA: { id: string; auth: string };
  let adminB: { id: string; auth: string };
  let buyer: { id: string; auth: string };
  let rep: { auth: string };
  let householdId: string;
  let requestId: string;
  let optOutId: string;

  const day = 86_400_000;
  const draft = (coordinationOptIn: boolean, invited: string[] = []) => ({
    design: `Cups ${coordinationOptIn}`,
    quantity: 100,
    unit: 'cup',
    destination: 'Hanoi',
    requiredBy: new Date(Date.now() + 20 * day).toISOString(),
    biddingClosesAt: new Date(Date.now() + 5 * day).toISOString(),
    invitedHouseholdIds: invited,
    coordinationOptIn,
  });
  const send = async (body: object) => {
    const created = await t.request({ method: 'POST', url: '/rfqs', auth: buyer.auth, body });
    expect(created.status).toBe(201);
    const sent = await t.request({
      method: 'POST',
      url: `/rfqs/${created.body.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': `"${created.body.version}"` },
    });
    expect(sent.status).toBe(200);
    return sent.body;
  };
  const queue = (auth: string) => t.request({ method: 'GET', url: '/admin/coordination', auth });
  const auditLog = async (query = '') =>
    (await t.request({ method: 'GET', url: `/admin/audit-log${query}`, auth: adminA.auth })).body;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    adminA = await t.createUser('ADMIN');
    adminB = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Queue household', slug: 'queue-household', history: '' },
    });
    householdId = applied.body.id;
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: adminA.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
    expect(approved.status).toBe(200);
    requestId = (await send(draft(true, [householdId]))).id;
    optOutId = (await send(draft(false, [householdId]))).id;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('is admin-only', async () => {
    expect((await queue(buyer.auth)).status).toBe(403);
    expect((await queue(rep.auth)).status).toBe(403);
    const log = await t.request({ method: 'GET', url: '/admin/audit-log', auth: buyer.auth });
    expect(log.status).toBe(403);
  });

  it('lists only requests whose buyer asked for coordination, without household prices', async () => {
    const offer = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/contributions`,
      auth: rep.auth,
      body: {
        maxQuantity: 100,
        unitPriceVnd: 123_456,
        completionDate: new Date(Date.now() + 10 * day).toISOString(),
      },
    });
    expect(offer.status).toBe(201);
    const { status, body } = await queue(adminA.auth);
    expect(status).toBe(200);
    expect(body.map((row: { id: string }) => row.id)).toEqual([requestId]);
    expect(body.map((row: { id: string }) => row.id)).not.toContain(optOutId);
    expect(body[0]).toMatchObject({
      contributionCount: 1,
      claimed: false,
      claimedByMe: false,
      coordinatorName: null,
    });
    expect(JSON.stringify(body)).not.toContain('123456');
  });

  it('lets one admin claim a request and shuts the other out', async () => {
    const [row] = (await queue(adminA.auth)).body;
    const claimed = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/coordinate`,
      auth: adminA.auth,
      headers: { 'if-match': `"${row.version}"` },
    });
    expect(claimed.status).toBe(200);
    const [mine] = (await queue(adminA.auth)).body;
    expect(mine).toMatchObject({ claimed: true, claimedByMe: true });
    const [theirs] = (await queue(adminB.auth)).body;
    expect(theirs).toMatchObject({ claimed: true, claimedByMe: false });
    expect(theirs.coordinatorName).toBeTruthy();
    const second = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/coordinate`,
      auth: adminB.auth,
      headers: { 'if-match': `"${theirs.version}"` },
    });
    expect(second.status).toBe(404);
  });

  it('writes an audit entry for each coordination action', async () => {
    const [row] = (await queue(adminA.auth)).body;
    const invited = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/invitations`,
      auth: adminA.auth,
      headers: { 'if-match': `"${row.version}"` },
      body: { householdIds: [householdId] },
    });
    expect(invited.status).toBe(200);
    const coordination = await t.request({
      method: 'GET',
      url: `/rfqs/${requestId}/coordination`,
      auth: adminA.auth,
    });
    const offer = coordination.body.contributions[0];
    const quotation = await t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/quotations`,
      auth: adminA.auth,
      headers: { 'if-match': `"${coordination.body.request.version}"` },
      body: {
        parts: [
          {
            householdId,
            quantity: 100,
            unitPriceVnd: offer.unitPriceVnd,
            completionDate: offer.completionDate,
            contributionVersion: offer.version,
          },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(quotation.status).toBe(201);

    const claim = (await auditLog('?action=rfq.claim')).data;
    expect(claim).toHaveLength(1);
    expect(claim[0]).toMatchObject({
      actorId: adminA.id,
      entity: 'rfq',
      entityId: requestId,
      before: { coordinatorId: null },
      after: { coordinatorId: adminA.id },
    });
    expect((await auditLog('?action=rfq.invite')).data).toHaveLength(1);
    expect((await auditLog('?action=rfq.quotation_submit')).data[0]).toMatchObject({
      entity: 'quotation',
      after: { totalVnd: 12_345_600 },
    });
  });

  it('filters by actor, action and date, and pages with a cursor', async () => {
    const all = await auditLog();
    expect(all.data.length).toBeGreaterThanOrEqual(4);
    expect(all.data[0].actorName).toBeTruthy();
    expect((await auditLog(`?actorId=${adminB.id}`)).data).toEqual([]);
    expect((await auditLog('?from=2000-01-01&to=2000-01-02')).data).toEqual([]);
    const first = await auditLog('?limit=2');
    expect(first.data).toHaveLength(2);
    const second = await auditLog(`?limit=2&cursor=${first.nextCursor}`);
    expect(second.data[0].id).not.toBe(first.data[0].id);
    expect(second.data[0].id).not.toBe(first.data[1].id);
    const actors = await t.request({
      method: 'GET',
      url: '/admin/audit-log/actors',
      auth: adminA.auth,
    });
    expect(actors.body.map((a: { id: string }) => a.id)).toEqual(
      expect.arrayContaining([adminA.id, adminB.id]),
    );
  });
});
