import { QuotationRequest } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * vCRAFT-bda.5 (GH#248 s4-12, FR-RFQ-13): the buyer duplicates an owned request into a fresh draft.
 * Seam: POST /rfqs/:id/duplicate over HTTP on a real app — auth, ownership, consent and the reset
 * rules are all enforced server-side, so the tests observe only public behavior.
 */
describe('Buyer duplicates an owned request (FR-RFQ-13)', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { auth: string };

  const day = 86_400_000;
  const body = (overrides: object = {}) => ({
    title: 'Logo cups',
    category: 'TABLEWARE',
    budgetMinVnd: 1_000_000,
    budgetMaxVnd: 2_000_000,
    design: '100 cups with a printed logo',
    customRequirements: 'Print the logo in cobalt',
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
  const duplicate = (id: string, auth = buyer.auth) =>
    t.request({ method: 'POST', url: `/rfqs/${id}/duplicate`, auth });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('copies editable content into a fresh DRAFT and leaves the original untouched', async () => {
    const original = await create();
    const res = await duplicate(original.id);
    expect(res.status).toBe(201);
    const copy = res.body;
    expect(copy.id).not.toBe(original.id);
    expect(copy.status).toBe('DRAFT');
    expect(copy.title).toBe('Logo cups');
    expect(copy.design).toBe(original.design);
    expect(copy.customRequirements).toBe(original.customRequirements);
    expect(copy.quantity).toBe(original.quantity);
    expect(copy.unit).toBe(original.unit);
    expect(copy.destination).toBe(original.destination);
    expect(copy.budgetMinVnd).toBe(original.budgetMinVnd);
    expect(copy.budgetMaxVnd).toBe(original.budgetMaxVnd);
    expect(copy.category).toBe(original.category);
    expect(copy.coordinationOptIn).toBe(original.coordinationOptIn);
    expect(copy.invitedHouseholdIds).toEqual(original.invitedHouseholdIds);
    // Fresh draft dates: the deadline is at least a day away and delivery follows it (T1).
    expect(new Date(copy.biddingClosesAt).getTime()).toBeGreaterThan(
      Date.now() + 24 * 60 * 60 * 1000 - 60_000,
    );
    expect(new Date(copy.requiredBy).getTime()).toBeGreaterThan(
      new Date(copy.biddingClosesAt).getTime(),
    );
    // The original keeps its identity, status and dates.
    const after = await t.request({ method: 'GET', url: `/rfqs/${original.id}`, auth: buyer.auth });
    expect(after.status).toBe(200);
    expect(after.body.id).toBe(original.id);
    expect(after.body.status).toBe(original.status);
    expect(after.body.biddingClosesAt).toBe(original.biddingClosesAt);
    expect(after.body.requiredBy).toBe(original.requiredBy);
  });

  it.each(['CANCELLED', 'DELIVERED'] as const)(
    'copies a %s request without carrying its workflow',
    async (status) => {
      const original = await create();
      await db.orm.em.fork().nativeUpdate(QuotationRequest, original.id, {
        status,
        biddingClosesAt: new Date(Date.now() - 2 * day),
        requiredBy: new Date(Date.now() - day),
      });
      const result = await duplicate(original.id);
      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({ status: 'DRAFT', cancelReason: null, attachments: [] });
      expect(result.body.id).not.toBe(original.id);
      expect(
        (
          await t.request({
            method: 'GET',
            url: `/rfqs/${result.body.id}/quotations`,
            auth: buyer.auth,
          })
        ).body,
      ).toEqual([]);
      expect(
        (
          await t.request({
            method: 'GET',
            url: `/rfqs/${result.body.id}/allocations`,
            auth: buyer.auth,
          })
        ).body,
      ).toEqual([]);
      expect(
        (await t.request({ method: 'GET', url: `/rfqs/${original.id}`, auth: buyer.auth })).body
          .status,
      ).toBe(status);
    },
  );

  it('refuses a foreign request with 404 and never leaks its content', async () => {
    const created = await create();
    const stranger = await t.createUser('BUYER');
    const res = await duplicate(created.id, stranger.auth);
    expect(res.status).toBe(404);
    expect(res.body.id).toBeUndefined();
    const listed = await t.request({ method: 'GET', url: '/rfqs', auth: stranger.auth });
    expect(listed.body.data.map((row: { id: string }) => row.id)).not.toContain(created.id);
  });

  it('re-arms expired dates on the copy so the buyer can review and submit it later', async () => {
    // The create schema only orders delivery after the deadline; a past deadline passes it and
    // leaves the request unsubmittable (T1 refuses at submit time), exactly like an expired one.
    const stale = await create({
      requiredBy: new Date(Date.now() + day).toISOString(),
      biddingClosesAt: new Date(Date.now() - day).toISOString(),
    });
    const res = await duplicate(stale.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.biddingClosesAt).not.toBe(stale.biddingClosesAt);
    expect(new Date(res.body.biddingClosesAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(res.body.requiredBy).getTime()).toBeGreaterThan(
      new Date(res.body.biddingClosesAt).getTime(),
    );
  });
});
