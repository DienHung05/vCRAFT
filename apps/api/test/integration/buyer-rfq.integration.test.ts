import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Issue #34: the buyer's list, draft autosave and cancellation with a required reason. */
describe('Buyer quotation requests', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };
  let other: { auth: string };
  let rep: { auth: string };
  let admin: { auth: string };
  let householdId: string;

  const day = 86_400_000;
  const body = (overrides: object = {}) => ({
    title: 'Logo cups',
    category: 'TABLEWARE',
    budgetMinVnd: 1_000_000,
    budgetMaxVnd: 2_000_000,
    design: '100 cups with a printed logo',
    quantity: 100,
    unit: 'cup',
    destination: 'Hanoi',
    requiredBy: new Date(Date.now() + 20 * day).toISOString(),
    biddingClosesAt: new Date(Date.now() + 5 * day).toISOString(),
    coordinationOptIn: true,
    ...overrides,
  });
  const create = async (overrides: object = {}, auth = buyer.auth) => {
    const res = await t.request({ method: 'POST', url: '/rfqs', auth, body: body(overrides) });
    expect(res.status).toBe(201);
    return res.body;
  };
  const submit = async (request: { id: string; version: number }) => {
    const res = await t.request({
      method: 'POST',
      url: `/rfqs/${request.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': `"${request.version}"` },
    });
    expect(res.status).toBe(200);
    return res.body;
  };
  const cancel = (request: { id: string; version: number }, reason: unknown, auth = buyer.auth) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${request.id}/cancel`,
      auth,
      headers: { 'if-match': `"${request.version}"` },
      body: { reason },
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    rep = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Buyer test household', slug: 'buyer-test-household', history: '' },
    });
    householdId = applied.body.id;
    await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('keeps title, category and budget, and rejects an inverted budget', async () => {
    const created = await create();
    expect(created).toMatchObject({
      status: 'DRAFT',
      title: 'Logo cups',
      category: 'TABLEWARE',
      budgetMinVnd: 1_000_000,
      budgetMaxVnd: 2_000_000,
      design: '100 cups with a printed logo',
    });
    const bad = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: body({ budgetMinVnd: 5, budgetMaxVnd: 1 }),
    });
    expect(bad.status).toBe(422);
  });

  it('falls back to the description when a request has no title', async () => {
    const created = await create({ title: undefined, category: undefined });
    expect(created.title).toBe('100 cups with a printed logo');
    expect(created.category).toBeNull();
  });

  it('autosaves a draft with its version, for the owner and only while it is a draft', async () => {
    const created = await create();
    const put = (version: number, auth = buyer.auth, id = created.id) =>
      t.request({
        method: 'PUT',
        url: `/rfqs/${id}`,
        auth,
        headers: { 'if-match': `"${version}"` },
        body: body({ title: 'Renamed' }),
      });
    expect((await put(created.version, other.auth)).status).toBe(404);
    const saved = await put(created.version);
    expect(saved.status).toBe(200);
    expect(saved.body.title).toBe('Renamed');
    expect((await put(created.version)).status).toBe(409);
    await submit(saved.body);
    const fresh = await t.request({ method: 'GET', url: `/rfqs/${created.id}`, auth: buyer.auth });
    const late = await put(fresh.body.version);
    expect(late.status).toBe(409);
  });

  it('lists only the signed-in buyer requests, filtered by status and paged', async () => {
    const mine = await create({ title: 'Listed draft' });
    const sent = await submit(await create({ title: 'Listed sent' }));
    await create({ title: 'Someone else' }, other.auth);

    const all = await t.request({ method: 'GET', url: '/rfqs?limit=100', auth: buyer.auth });
    expect(all.status).toBe(200);
    const titles = all.body.data.map((row: { title: string }) => row.title);
    expect(titles).toContain('Listed draft');
    expect(titles).toContain('Listed sent');
    expect(titles).not.toContain('Someone else');
    expect(all.body.data[0].openQuotationCount).toBe(0);

    const drafts = await t.request({ method: 'GET', url: '/rfqs?status=DRAFT', auth: buyer.auth });
    expect(drafts.body.data.map((row: { id: string }) => row.id)).toContain(mine.id);
    expect(drafts.body.data.map((row: { id: string }) => row.id)).not.toContain(sent.id);

    const first = await t.request({ method: 'GET', url: '/rfqs?limit=1', auth: buyer.auth });
    expect(first.body.nextCursor).toBeTruthy();
    const second = await t.request({
      method: 'GET',
      url: `/rfqs?limit=1&cursor=${first.body.nextCursor}`,
      auth: buyer.auth,
    });
    expect(second.body.data[0].id).not.toBe(first.body.data[0].id);

    const denied = await t.request({ method: 'GET', url: '/rfqs', auth: admin.auth });
    expect(denied.status).toBe(403);
  });

  it('cancels with a required reason, and only for the owner', async () => {
    const sent = await submit(await create({ invitedHouseholdIds: [householdId] }));
    expect((await cancel(sent, '   ')).status).toBe(422);
    expect((await cancel(sent, 'Not mine', other.auth)).status).toBe(404);
    const done = await cancel(sent, 'Plans changed');
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ status: 'CANCELLED', cancelReason: 'Plans changed' });
    expect((await cancel(done.body, 'Again')).status).toBe(409);
  });

  it('withdraws open quotations and tells the invited household when a buyer cancels', async () => {
    const sent = await submit(await create({ invitedHouseholdIds: [householdId] }));
    const claimed = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.id}/coordinate`,
      auth: admin.auth,
      headers: { 'if-match': `"${sent.version}"` },
    });
    const offer = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.id}/contributions`,
      auth: rep.auth,
      body: {
        maxQuantity: 100,
        unitPriceVnd: 20_000,
        completionDate: new Date(Date.now() + 10 * day).toISOString(),
      },
    });
    const view = await t.request({
      method: 'GET',
      url: `/rfqs/${sent.id}`,
      auth: admin.auth,
    });
    expect(claimed.status).toBe(200);
    const quotation = await t.request({
      method: 'POST',
      url: `/rfqs/${sent.id}/quotations`,
      auth: admin.auth,
      headers: { 'if-match': `"${view.body.version}"` },
      body: {
        parts: [
          {
            householdId,
            quantity: 100,
            unitPriceVnd: 20_000,
            completionDate: offer.body.completionDate,
            contributionVersion: offer.body.version,
          },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(quotation.status).toBe(201);
    const list = await t.request({ method: 'GET', url: '/rfqs?limit=100', auth: buyer.auth });
    const row = list.body.data.find((item: { id: string }) => item.id === sent.id);
    expect(row.openQuotationCount).toBe(1);

    const done = await cancel(row, 'Found another supplier');
    expect(done.status).toBe(200);
    const after = await t.request({
      method: 'GET',
      url: `/rfqs/${sent.id}/quotations`,
      auth: buyer.auth,
    });
    expect(after.body[0].status).toBe('WITHDRAWN');
    const notices = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: rep.auth,
    });
    expect(
      notices.body.some(
        (notice: { requestId: string; kind: string }) =>
          notice.requestId === sent.id && notice.kind === 'ORDER_CANCELLED',
      ),
    ).toBe(true);
  });

  it('notifies nobody when a draft is cancelled', async () => {
    const created = await create({ invitedHouseholdIds: [householdId] });
    const done = await cancel(created, 'Changed my mind');
    expect(done.status).toBe(200);
    const notices = await t.request({
      method: 'GET',
      url: '/me/quotation-notices',
      auth: rep.auth,
    });
    expect(
      notices.body.some((notice: { requestId: string }) => notice.requestId === created.id),
    ).toBe(false);
  });
});
