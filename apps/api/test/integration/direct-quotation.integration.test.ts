import {
  AllocationResponseSchema,
  BuyerQuotationResponseSchema,
  DirectQuotationResponseSchema,
} from '@vcraft/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** GH#243: a household quotes a request without coordination, and the buyer accepts it like any quotation. */
describe('direct household quotations', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let admin: { auth: string };
  let repA: { auth: string; householdId: string };
  let repB: { auth: string; householdId: string };
  let repC: { auth: string; householdId: string };

  const day = 86_400_000;
  const completionDate = new Date(Date.now() + 10 * day).toISOString();

  const household = async (name: string) => {
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
    return { auth: rep.auth, householdId: applied.body.id as string };
  };

  const send = async (invited: string[], coordinationOptIn = false, quantity = 100) => {
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
    return sent.body as { id: string; version: number; status: string };
  };
  const quote = (
    requestId: string,
    auth: string,
    overrides: Record<string, unknown> = {},
    unitPriceVnd = 30_000,
  ) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/direct-quotations`,
      auth,
      body: { unitPriceVnd, completionDate, ...overrides },
    });
  const revise = (id: string, version: number, auth: string, unitPriceVnd: number) =>
    t.request({
      method: 'PUT',
      url: `/direct-quotations/${id}`,
      auth,
      headers: { 'if-match': String(version) },
      body: { unitPriceVnd, completionDate, note: 'revised' },
    });
  const withdraw = (id: string, version: number, auth: string) =>
    t.request({
      method: 'POST',
      url: `/direct-quotations/${id}/withdraw`,
      auth,
      headers: { 'if-match': String(version) },
    });
  const request = (id: string, auth: string) =>
    t.request({ method: 'GET', url: `/rfqs/${id}`, auth });
  const buyerQuotations = async (id: string) => {
    const res = await t.request({ method: 'GET', url: `/rfqs/${id}/quotations`, auth: buyer.auth });
    expect(res.status).toBe(200);
    return res.body as Array<{
      id: string;
      status: string;
      bidType: string;
      note: string | null;
      totalVnd: number;
      parts: Array<{ householdId: string; householdName: string; unitPriceVnd?: number }>;
    }>;
  };
  const accept = async (requestId: string, quotationId: string) => {
    const current = await request(requestId, buyer.auth);
    return t.request({
      method: 'POST',
      url: `/rfqs/${requestId}/accept`,
      auth: buyer.auth,
      headers: { 'if-match': String(current.body.version) },
      body: { quotationId },
    });
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    repA = await household('direct-household-a');
    repB = await household('direct-household-b');
    repC = await household('direct-household-c');
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('lets an invited household quote the whole quantity and moves the request to BIDDING', async () => {
    const rfq = await send([repA.householdId, repB.householdId]);
    expect(rfq.status).toBe('SENT');
    const res = await quote(rfq.id, repA.auth, { note: 'Fired twice' });
    expect(res.status).toBe(201);
    expect(DirectQuotationResponseSchema.parse(res.body)).toMatchObject({
      status: 'SUBMITTED',
      quantity: 100,
      unitPriceVnd: 30_000,
      totalVnd: 3_000_000,
      note: 'Fired twice',
    });
    expect((await request(rfq.id, buyer.auth)).body.status).toBe('BIDDING');

    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/direct-quotations`,
      auth: repA.auth,
    });
    expect(own.body).toHaveLength(1);
    const invitations = await t.request({ method: 'GET', url: '/me/invitations', auth: repA.auth });
    const row = invitations.body.find(
      (item: { request: { id: string } }) => item.request.id === rfq.id,
    );
    expect(row.directQuotation).toMatchObject({ id: res.body.id, unitPriceVnd: 30_000 });
    // The other household sees no trace of it.
    const other = await t.request({ method: 'GET', url: '/me/invitations', auth: repB.auth });
    expect(
      other.body.find((item: { request: { id: string } }) => item.request.id === rfq.id)
        .directQuotation,
    ).toBeNull();
  });

  it('shows the buyer every active quotation with household name, unit price and total', async () => {
    const rfq = await send([repA.householdId, repB.householdId]);
    expect((await quote(rfq.id, repA.auth, {}, 30_000)).status).toBe(201);
    expect((await quote(rfq.id, repB.auth, {}, 28_000)).status).toBe(201);
    const list = await buyerQuotations(rfq.id);
    expect(list).toHaveLength(2);
    for (const item of list)
      expect(BuyerQuotationResponseSchema.safeParse(item).success).toBe(true);
    expect(list.map((item) => [item.bidType, item.parts[0]?.unitPriceVnd, item.totalVnd])).toEqual([
      ['INDIVIDUAL', 30_000, 3_000_000],
      ['INDIVIDUAL', 28_000, 2_800_000],
    ]);
    expect(list[0]?.parts[0]).toMatchObject({
      householdId: repA.householdId,
      householdName: 'direct-household-a',
    });
    const listed = await t.request({ method: 'GET', url: '/rfqs', auth: buyer.auth });
    expect(
      listed.body.data.find((item: { id: string }) => item.id === rfq.id).openQuotationCount,
    ).toBe(2);
  });

  it('keeps one active quotation per household (BR-L3) and checks the completion window', async () => {
    const rfq = await send([repA.householdId]);
    expect((await quote(rfq.id, repA.auth)).status).toBe(201);
    const again = await quote(rfq.id, repA.auth);
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('RFQ_BID_ALREADY_EXISTS');

    const late = await send([repA.householdId]);
    const tooLate = await quote(late.id, repA.auth, {
      completionDate: new Date(Date.now() + 30 * day).toISOString(),
    });
    expect(tooLate.status).toBe(422);
    const tooEarly = await quote(late.id, repA.auth, {
      completionDate: new Date(Date.now() + 1 * day).toISOString(),
    });
    expect(tooEarly.status).toBe(422);
    const free = await quote(late.id, repA.auth, {}, 0);
    expect(free.status).toBe(422);
  });

  it('refuses households that were not invited, other roles, and coordinated requests', async () => {
    const rfq = await send([repA.householdId]);
    expect((await quote(rfq.id, repC.auth)).status).toBe(404);
    expect((await quote(rfq.id, buyer.auth)).status).toBe(403);
    expect((await quote(rfq.id, admin.auth)).status).toBe(403);
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/rfqs/${rfq.id}/direct-quotations`,
          auth: repC.auth,
        })
      ).status,
    ).toBe(404);

    const coordinated = await send([repA.householdId], true);
    const res = await quote(coordinated.id, repA.auth);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('RFQ_DIRECT_QUOTATION_NOT_ALLOWED');
    // The coordinated flow is unchanged: contributions still work and the board still builds the quotation.
    const contribution = await t.request({
      method: 'POST',
      url: `/rfqs/${coordinated.id}/contributions`,
      auth: repA.auth,
      body: { maxQuantity: 100, unitPriceVnd: 25_000, completionDate },
    });
    expect(contribution.status).toBe(201);
    expect((await request(coordinated.id, buyer.auth)).body.status).toBe('SENT');
    // The board neither sees nor builds quotations for a request nobody coordinates.
    const board = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/quotations`,
      auth: admin.auth,
    });
    expect(board.status).toBe(404);
  });

  it('revises a quotation with a version check, and only for its own household', async () => {
    const rfq = await send([repA.householdId, repB.householdId]);
    const first = (await quote(rfq.id, repA.auth)).body;
    expect((await revise(first.id, first.version, repB.auth, 20_000)).status).toBe(404);
    const revised = await revise(first.id, first.version, repA.auth, 27_000);
    expect(revised.status).toBe(200);
    expect(revised.body).toMatchObject({
      id: first.id,
      unitPriceVnd: 27_000,
      totalVnd: 2_700_000,
      note: 'revised',
    });
    expect(revised.body.version).toBeGreaterThan(first.version);
    const stale = await revise(first.id, first.version, repA.auth, 26_000);
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
    const [seen] = await buyerQuotations(rfq.id);
    expect(seen).toMatchObject({ totalVnd: 2_700_000, note: 'revised' });
  });

  it('withdraws while the request is open, then lets the household quote again', async () => {
    const rfq = await send([repA.householdId]);
    const first = (await quote(rfq.id, repA.auth)).body;
    const gone = await withdraw(first.id, first.version, repA.auth);
    expect(gone.status).toBe(200);
    expect(gone.body.status).toBe('WITHDRAWN');
    expect((await buyerQuotations(rfq.id)).map((item) => item.status)).toEqual(['WITHDRAWN']);
    expect((await revise(first.id, gone.body.version, repA.auth, 20_000)).status).toBe(409);
    const second = await quote(rfq.id, repA.auth, {}, 29_000);
    expect(second.status).toBe(201);
    const own = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/direct-quotations`,
      auth: repA.auth,
    });
    expect(own.body.map((item: { status: string }) => item.status)).toEqual([
      'SUBMITTED',
      'WITHDRAWN',
    ]);
  });

  it('notifies the buyer of a new, revised and withdrawn quotation', async () => {
    const rfq = await send([repA.householdId]);
    const first = (await quote(rfq.id, repA.auth)).body;
    const revised = (await revise(first.id, first.version, repA.auth, 26_000)).body;
    await withdraw(first.id, revised.version, repA.auth);
    const notices = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: buyer.auth,
    });
    const kinds = notices.body
      .filter((notice: { requestId: string }) => notice.requestId === rfq.id)
      .map((notice: { kind: string }) => notice.kind)
      .sort();
    expect(kinds).toEqual(['QUOTATION_RECEIVED', 'QUOTATION_RECEIVED', 'QUOTATION_WITHDRAWN']);
  });

  it('accepts one quotation: a single allocation, the others not chosen, then the whole order runs', async () => {
    const rfq = await send([repA.householdId, repB.householdId]);
    const a = (await quote(rfq.id, repA.auth, {}, 30_000)).body;
    const b = (await quote(rfq.id, repB.auth, {}, 28_000)).body;
    const accepted = await accept(rfq.id, b.id);
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');

    const list = await buyerQuotations(rfq.id);
    expect(list.find((item) => item.id === a.id)?.status).toBe('REJECTED');
    expect(list.find((item) => item.id === b.id)?.status).toBe('ACCEPTED');
    // Nobody can revise or withdraw once the buyer has chosen.
    expect((await revise(a.id, a.version, repA.auth, 10_000)).status).toBe(409);

    const allocations = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/allocations`,
      auth: buyer.auth,
    });
    expect(allocations.body).toHaveLength(1);
    const share = AllocationResponseSchema.parse(allocations.body[0]);
    expect(share).toMatchObject({
      householdId: repB.householdId,
      quantity: 100,
      status: 'PROPOSED',
    });
    // The household that was not chosen has no share to read.
    const none = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/allocations`,
      auth: repA.auth,
    });
    expect(none.body).toEqual([]);
    const proposed = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: repB.auth,
    });
    expect(proposed.body.map((notice: { kind: string }) => notice.kind)).toContain(
      'ALLOCATION_PROPOSED',
    );

    // Same confirmation steps as a one-part cooperative quotation (FR-ORD-05, 06, 08).
    const confirmed = await t.request({
      method: 'POST',
      url: `/allocations/${share.id}/confirm`,
      auth: repB.auth,
      headers: { 'if-match': String(share.version) },
    });
    expect(confirmed.status).toBe(200);
    const current = await request(rfq.id, repB.auth);
    const started = await t.request({
      method: 'POST',
      url: `/rfqs/${rfq.id}/start-production`,
      auth: repB.auth,
      headers: { 'if-match': String(current.body.version) },
    });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('IN_PRODUCTION');
    const running = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/allocations`,
      auth: repB.auth,
    });
    expect(running.body[0].status).toBe('IN_PROGRESS');
    const progress = await t.request({
      method: 'POST',
      url: `/allocations/${share.id}/progress`,
      auth: repB.auth,
      headers: { 'if-match': String(running.body[0].version) },
      body: { completedQty: 100 },
    });
    expect(progress.status).toBe(200);
    expect(progress.body.status).toBe('DONE');
    const latest = await request(rfq.id, buyer.auth);
    const received = await t.request({
      method: 'POST',
      url: `/rfqs/${rfq.id}/receive`,
      auth: buyer.auth,
      headers: { 'if-match': String(latest.body.version) },
    });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('DELIVERED');
  });

  it('refuses a stale accept after the household revised its price', async () => {
    const rfq = await send([repA.householdId]);
    const first = (await quote(rfq.id, repA.auth)).body;
    const seen = await request(rfq.id, buyer.auth);
    await revise(first.id, first.version, repA.auth, 35_000);
    const stale = await t.request({
      method: 'POST',
      url: `/rfqs/${rfq.id}/accept`,
      auth: buyer.auth,
      headers: { 'if-match': String(seen.body.version) },
      body: { quotationId: first.id },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');
  });

  it('includes the household quotations and the request requirements in the data export', async () => {
    const rfq = await send([repC.householdId]);
    const mine = (await quote(rfq.id, repC.auth, { note: 'Exported' }, 31_000)).body;
    const exported = await t.request({ method: 'GET', url: '/me/data-export', auth: repC.auth });
    expect(exported.status).toBe(200);
    expect(exported.body.directQuotations).toEqual([
      expect.objectContaining({
        id: mine.id,
        requestId: rfq.id,
        unitPriceVnd: 31_000,
        totalVnd: 3_100_000,
        note: 'Exported',
      }),
    ]);
    const buyerExport = await t.request({
      method: 'GET',
      url: '/me/data-export',
      auth: buyer.auth,
    });
    const row = buyerExport.body.quotationRequests.find(
      (item: { id: string }) => item.id === rfq.id,
    );
    expect(row).toMatchObject({ customRequirements: null, attachmentIds: [] });
  });

  it('lets the board cancel an accepted order nobody coordinates, and asks it to act on a decline', async () => {
    const rfq = await send([repA.householdId]);
    const first = (await quote(rfq.id, repA.auth)).body;
    expect((await accept(rfq.id, first.id)).status).toBe(200);
    const allocations = await t.request({
      method: 'GET',
      url: `/rfqs/${rfq.id}/allocations`,
      auth: repA.auth,
    });
    const share = allocations.body[0];
    const declined = await t.request({
      method: 'POST',
      url: `/allocations/${share.id}/decline`,
      auth: repA.auth,
      headers: { 'if-match': String(share.version) },
    });
    expect(declined.status).toBe(200);
    const notices = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: admin.auth,
    });
    expect(
      notices.body.some(
        (notice: { kind: string; requestId: string }) =>
          notice.kind === 'COORDINATION_NEEDED' && notice.requestId === rfq.id,
      ),
    ).toBe(true);

    const current = await request(rfq.id, buyer.auth);
    const cancelled = await t.request({
      method: 'POST',
      url: `/rfqs/${rfq.id}/cancel`,
      auth: admin.auth,
      headers: { 'if-match': String(current.body.version) },
      body: { reason: 'The household cannot make it' },
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });
});
