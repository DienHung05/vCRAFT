import { HouseholdRating } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#248 (s4-11, s5-10, s5-11, s5-12): notices for the buyer and for households that were not chosen,
 * the buyer's ratings of households after delivery, and an administrator's request for an off-platform
 * customer. Seam: the public HTTP API on a real app; every rule is enforced server-side.
 */
describe('Order notices, ratings and requests made for a customer', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let otherAdmin: { id: string; auth: string };
  let buyer: { id: string; auth: string };
  let stranger: { id: string; auth: string };
  let reps: Array<{ auth: string; householdId: string; slug: string }>;

  const day = 86_400_000;
  const deadline = new Date(Date.now() + 2 * day).toISOString();
  const completionDate = new Date(Date.now() + 10 * day).toISOString();
  const requiredBy = new Date(Date.now() + 20 * day).toISOString();
  const customer = { name: 'Nguyen Van An', phone: '0912 345 678', email: 'an@example.com' };

  const rep = (index: number) => {
    const found = reps[index];
    if (!found) throw new Error(`missing representative ${index}`);
    return found;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    otherAdmin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    stranger = await t.createUser('BUYER');
    reps = [];
    for (const name of ['rating-household-a', 'rating-household-b', 'rating-household-c']) {
      const user = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
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
      reps.push({ auth: user.auth, householdId: applied.body.id, slug: name });
    }
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  const requestBody = (overrides: object = {}) => ({
    design: 'Logo cups',
    quantity: 3500,
    unit: 'cup',
    destination: 'Ha Noi',
    requiredBy,
    biddingClosesAt: deadline,
    invitedHouseholdIds: reps.map((r) => r.householdId),
    coordinationOptIn: true,
    ...overrides,
  });

  const version = async (id: string, auth: string) =>
    String((await t.request({ method: 'GET', url: `/rfqs/${id}`, auth })).body.version);

  const inbox = async (auth: string) =>
    (await t.request({ method: 'GET', url: '/me/quotation-notices', auth })).body as Array<{
      kind: string;
      requestId: string;
    }>;
  const kindsFor = async (auth: string, requestId: string) =>
    (await inbox(auth)).filter((n) => n.requestId === requestId).map((n) => n.kind);

  /**
   * Runs a request through submit, offers from households A and B (C is invited and stays silent), the
   * coordinator's quotation and the accept, by the buyer or by the administrator who owns the request.
   */
  async function accepted(owner: { auth: string }, onBehalf = false) {
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: owner.auth,
      body: requestBody(onBehalf ? { onBehalfOf: customer } : {}),
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    const sent = await t.request({
      method: 'POST',
      url: `/rfqs/${id}/submit`,
      auth: owner.auth,
      headers: { 'if-match': String(created.body.version) },
    });
    expect(sent.status).toBe(200);
    if (!onBehalf) {
      const claimed = await t.request({
        method: 'POST',
        url: `/rfqs/${id}/coordinate`,
        auth: admin.auth,
        headers: { 'if-match': String(sent.body.version) },
      });
      expect(claimed.status).toBe(200);
    }
    for (const [index, member] of [rep(0), rep(1)].entries()) {
      const offer = await t.request({
        method: 'POST',
        url: `/rfqs/${id}/contributions`,
        auth: member.auth,
        body: { maxQuantity: index === 0 ? 2000 : 1500, unitPriceVnd: 30_000, completionDate },
      });
      expect(offer.status).toBe(201);
    }
    const offers = await t.request({
      method: 'GET',
      url: `/rfqs/${id}/contributions`,
      auth: admin.auth,
    });
    const quotation = await t.request({
      method: 'POST',
      url: `/rfqs/${id}/quotations`,
      auth: admin.auth,
      headers: { 'if-match': await version(id, admin.auth) },
      body: {
        parts: offers.body.map(
          (o: {
            householdId: string;
            maxQuantity: number;
            unitPriceVnd: number;
            completionDate: string;
            version: number;
          }) => ({
            householdId: o.householdId,
            quantity: o.maxQuantity,
            unitPriceVnd: o.unitPriceVnd,
            completionDate: o.completionDate,
            contributionVersion: o.version,
          }),
        ),
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    });
    expect(quotation.status).toBe(201);
    const accept = await t.request({
      method: 'POST',
      url: `/rfqs/${id}/accept`,
      auth: owner.auth,
      headers: { 'if-match': await version(id, owner.auth) },
      body: { quotationId: quotation.body.id },
    });
    expect(accept.status).toBe(200);
    return id;
  }

  /** Confirms, starts production and finishes every share, leaving the request IN_PRODUCTION. */
  async function produced(id: string) {
    for (const member of [rep(0), rep(1)]) {
      const own = await t.request({
        method: 'GET',
        url: `/rfqs/${id}/allocations`,
        auth: member.auth,
      });
      const confirmed = await t.request({
        method: 'POST',
        url: `/allocations/${own.body[0].id}/confirm`,
        auth: member.auth,
        headers: { 'if-match': String(own.body[0].version) },
      });
      expect(confirmed.status).toBe(200);
    }
    const started = await t.request({
      method: 'POST',
      url: `/rfqs/${id}/start-production`,
      auth: admin.auth,
      headers: { 'if-match': await version(id, admin.auth) },
    });
    expect(started.status).toBe(200);
    for (const member of [rep(0), rep(1)]) {
      const own = await t.request({
        method: 'GET',
        url: `/rfqs/${id}/allocations`,
        auth: member.auth,
      });
      const done = await t.request({
        method: 'POST',
        url: `/allocations/${own.body[0].id}/progress`,
        auth: member.auth,
        headers: { 'if-match': String(own.body[0].version) },
        body: { completedQty: own.body[0].quantity },
      });
      expect(done.status).toBe(200);
    }
  }

  const receive = (id: string, auth: string, ifMatch: string) =>
    t.request({
      method: 'POST',
      url: `/rfqs/${id}/receive`,
      auth,
      headers: { 'if-match': ifMatch },
    });

  /** A buyer's request taken all the way to DELIVERED, received by the buyer. */
  async function delivered() {
    const id = await accepted(buyer);
    await produced(id);
    expect((await receive(id, buyer.auth, await version(id, buyer.auth))).status).toBe(200);
    return id;
  }

  const rate = (id: string, householdId: string, auth: string, body: object) =>
    t.request({ method: 'PUT', url: `/rfqs/${id}/ratings/${householdId}`, auth, body });

  describe('notices (s5-12, s4-11)', () => {
    it('tells the buyer when an administrator confirms receipt on their behalf', async () => {
      const id = await accepted(buyer);
      await produced(id);
      expect(await kindsFor(buyer.auth, id)).not.toContain('ORDER_RECEIVED');
      const res = await receive(id, admin.auth, await version(id, admin.auth));
      expect(res.status).toBe(200);
      expect(await kindsFor(buyer.auth, id)).toContain('ORDER_RECEIVED');
      expect(await kindsFor(rep(0).auth, id)).toContain('ORDER_RECEIVED');
      // The actor is never notified of their own action.
      expect(await kindsFor(admin.auth, id)).not.toContain('ORDER_RECEIVED');
    });

    it('does not send the buyer a notice for their own confirmation', async () => {
      const id = await accepted(buyer);
      await produced(id);
      expect((await receive(id, buyer.auth, await version(id, buyer.auth))).status).toBe(200);
      expect(await kindsFor(buyer.auth, id)).not.toContain('ORDER_RECEIVED');
    });

    it('tells invited households outside the accepted quotation that another offer was chosen', async () => {
      const id = await accepted(buyer);
      const silent = await kindsFor(rep(2).auth, id);
      expect(silent).toContain('RFQ_INVITED');
      expect(silent).toContain('RFQ_NOT_SELECTED');
      for (const chosen of [rep(0), rep(1)]) {
        const kinds = await kindsFor(chosen.auth, id);
        expect(kinds).toContain('ALLOCATION_PROPOSED');
        expect(kinds).not.toContain('RFQ_NOT_SELECTED');
      }
      expect(await kindsFor(buyer.auth, id)).not.toContain('RFQ_NOT_SELECTED');
    });
  });

  describe('ratings (s5-11)', () => {
    it('rates only after delivery', async () => {
      const id = await accepted(buyer);
      await produced(id);
      const early = await rate(id, rep(0).householdId, buyer.auth, { stars: 5 });
      expect(early.status).toBe(409);
      expect(early.body.code).toBe('INVALID_TRANSITION');
    });

    it('lets only the owning buyer rate, and only households that finished a share', async () => {
      const id = await delivered();
      for (const who of [stranger, admin, otherAdmin, rep(0)]) {
        const res = await rate(id, rep(0).householdId, who.auth, { stars: 5 });
        expect([403, 404]).toContain(res.status);
      }
      // Household C was invited but had no allocation.
      expect((await rate(id, rep(2).householdId, buyer.auth, { stars: 5 })).status).toBe(404);
      expect(
        (await rate(id, '00000000-0000-4000-8000-00000000f00d', buyer.auth, { stars: 5 })).status,
      ).toBe(404);
      const ok = await rate(id, rep(0).householdId, buyer.auth, {
        stars: 4,
        comment: 'Careful work',
      });
      expect(ok.status).toBe(200);
      expect(ok.body).toMatchObject({
        householdId: rep(0).householdId,
        stars: 4,
        comment: 'Careful work',
      });
      expect(new Date(ok.body.editableUntil).getTime()).toBeGreaterThan(Date.now() + 29 * day);
    });

    it('validates the stars and the comment length', async () => {
      const id = await delivered();
      for (const body of [
        { stars: 0 },
        { stars: 6 },
        { stars: 2.5 },
        {},
        { stars: 3, comment: 'x'.repeat(1001) },
        { stars: 3, extra: true },
      ]) {
        expect((await rate(id, rep(0).householdId, buyer.auth, body)).status).toBe(422);
      }
      expect(
        (await rate(id, rep(0).householdId, buyer.auth, { stars: 3, comment: 'y'.repeat(1000) }))
          .status,
      ).toBe(200);
    });

    it('keeps one rating per household, shows it to the owner and closes the edit window after 30 days', async () => {
      const id = await delivered();
      expect(
        (await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: buyer.auth })).body.ratings,
      ).toEqual([]);
      const first = await rate(id, rep(1).householdId, buyer.auth, { stars: 2, comment: 'Late' });
      expect(first.status).toBe(200);
      const second = await rate(id, rep(1).householdId, buyer.auth, { stars: 5 });
      expect(second.status).toBe(200);
      expect(second.body.stars).toBe(5);
      expect(second.body.comment).toBeNull();
      expect(second.body.createdAt).toBe(first.body.createdAt);
      const read = await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: buyer.auth });
      expect(read.body.ratings).toHaveLength(1);
      expect(read.body.ratings[0]).toMatchObject({ householdId: rep(1).householdId, stars: 5 });
      // Ratings are private to the owner.
      const coordinator = await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: admin.auth });
      expect(coordinator.body.ratings).toBeUndefined();
      const household = await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: rep(1).auth });
      expect(household.body.ratings).toBeUndefined();

      await db.orm.em
        .fork()
        .nativeUpdate(
          HouseholdRating,
          { request: id, household: rep(1).householdId },
          { createdAt: new Date(Date.now() - 31 * day) },
        );
      const late = await rate(id, rep(1).householdId, buyer.auth, { stars: 1 });
      expect(late.status).toBe(409);
      expect(late.body.detail).toContain('RATING_WINDOW_CLOSED');
    });

    it('publishes the average and count on the household page and the household list', async () => {
      // Household C never worked on an order, so it has no rating yet.
      const before = await t.request({ method: 'GET', url: `/households/${rep(2).slug}` });
      expect(before.body).toMatchObject({ ratingAverage: null, ratingCount: 0 });

      const first = await delivered();
      const second = await delivered();
      const target = rep(0).householdId;
      const existing = await db.orm.em.fork().count(HouseholdRating, { household: target });
      expect(
        (await rate(first, target, buyer.auth, { stars: 5, comment: 'private text' })).status,
      ).toBe(200);
      expect((await rate(second, target, buyer.auth, { stars: 4 })).status).toBe(200);
      const rows = await db.orm.em.fork().find(HouseholdRating, { household: target });
      const mean = rows.reduce((sum, row) => sum + row.stars, 0) / rows.length;
      const expected = Math.round(mean * 10) / 10;
      expect(rows).toHaveLength(existing + 2);

      const page = await t.request({ method: 'GET', url: `/households/${rep(0).slug}` });
      expect(page.status).toBe(200);
      expect(page.body.ratingAverage).toBe(expected);
      expect(page.body.ratingCount).toBe(rows.length);
      expect(JSON.stringify(page.body)).not.toContain('private text');

      const list = await t.request({ method: 'GET', url: '/households' });
      const card = list.body.data.find((h: { id: string }) => h.id === target);
      expect(card.ratingAverage).toBe(expected);
      expect(card.ratingCount).toBe(rows.length);
      const unrated = list.body.data.find((h: { id: string }) => h.id === rep(2).householdId);
      expect(unrated).toMatchObject({ ratingAverage: null, ratingCount: 0 });
    });
  });

  describe('request made for an off-platform customer (s5-10)', () => {
    it('lets an administrator create it, and keeps the buyer flow as it was', async () => {
      const made = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: admin.auth,
        body: requestBody({ coordinationOptIn: false, onBehalfOf: customer }),
      });
      expect(made.status).toBe(201);
      expect(made.body.status).toBe('DRAFT');
      // Always coordinated, by the administrator who made it; the phone is stored without separators.
      expect(made.body.coordinationOptIn).toBe(true);
      expect(made.body.onBehalfOf).toEqual({
        name: customer.name,
        phone: '0912345678',
        email: customer.email,
      });

      const own = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: buyer.auth,
        body: requestBody({ coordinationOptIn: false }),
      });
      expect(own.status).toBe(201);
      expect(own.body.coordinationOptIn).toBe(false);
      expect(own.body.onBehalfOf).toBeUndefined();
      const reread = await t.request({
        method: 'GET',
        url: `/rfqs/${own.body.id}`,
        auth: buyer.auth,
      });
      expect(reread.body.onBehalfOf).toBeUndefined();
    });

    it('validates the customer and refuses it from a buyer', async () => {
      const post = (auth: string, onBehalfOf?: object) =>
        t.request({
          method: 'POST',
          url: '/rfqs',
          auth,
          body: requestBody(onBehalfOf === undefined ? {} : { onBehalfOf }),
        });
      expect((await post(admin.auth)).status).toBe(422);
      expect((await post(admin.auth, { name: '', phone: '0912345678' })).status).toBe(422);
      expect((await post(admin.auth, { name: 'x'.repeat(121), phone: '0912345678' })).status).toBe(
        422,
      );
      for (const phone of ['12345', '0112345678', '+1 202 555 0100', 'abcdefghij']) {
        expect((await post(admin.auth, { name: 'An', phone })).status).toBe(422);
      }
      expect(
        (await post(admin.auth, { name: 'An', phone: '0912345678', email: 'not-an-email' })).status,
      ).toBe(422);
      expect((await post(admin.auth, { name: 'An', phone: '+84 912 345 678' })).status).toBe(201);
      expect((await post(admin.auth, { name: 'An', phone: '024 3825 1234' })).status).toBe(201);
      expect((await post(buyer.auth, { name: 'An', phone: '0912345678' })).status).toBe(422);
      // Households still cannot create requests.
      expect((await post(rep(0).auth, { name: 'An', phone: '0912345678' })).status).toBe(403);
    });

    it('lists it in the coordination queue with the customer, and hides the customer from others', async () => {
      const created = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: admin.auth,
        body: requestBody({ onBehalfOf: customer }),
      });
      const id = created.body.id as string;
      const sent = await t.request({
        method: 'POST',
        url: `/rfqs/${id}/submit`,
        auth: admin.auth,
        headers: { 'if-match': String(created.body.version) },
      });
      expect(sent.status).toBe(200);
      const queue = await t.request({
        method: 'GET',
        url: '/admin/coordination',
        auth: admin.auth,
      });
      const row = queue.body.find((r: { id: string }) => r.id === id);
      expect(row).toMatchObject({
        buyerName: customer.name,
        claimedByMe: true,
        onBehalfOf: { name: customer.name, phone: '0912345678' },
      });
      // Households see the request but never the customer's details.
      const asHousehold = await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: rep(0).auth });
      expect(asHousehold.status).toBe(200);
      expect(asHousehold.body.onBehalfOf).toBeUndefined();
      const invitations = await t.request({
        method: 'GET',
        url: '/me/invitations',
        auth: rep(0).auth,
      });
      expect(JSON.stringify(invitations.body)).not.toContain('0912345678');
      // Another administrator cannot act as the buyer of this request.
      const intruder = await t.request({
        method: 'POST',
        url: `/rfqs/${id}/accept`,
        auth: otherAdmin.auth,
        headers: { 'if-match': String(sent.body.version) },
        body: { quotationId: '00000000-0000-4000-8000-00000000f00d' },
      });
      expect(intruder.status).toBe(404);
    });

    it('does not let an administrator act as the buyer of a buyer request', async () => {
      const own = await t.request({
        method: 'POST',
        url: '/rfqs',
        auth: buyer.auth,
        body: requestBody(),
      });
      const submit = await t.request({
        method: 'POST',
        url: `/rfqs/${own.body.id}/submit`,
        auth: admin.auth,
        headers: { 'if-match': String(own.body.version) },
      });
      expect(submit.status).toBe(404);
    });

    it("lets the administrator accept, receive and rate on the customer's behalf", async () => {
      const id = await accepted(admin, true);
      // Households outside the quotation are told, and the administrator is the buyer of record.
      expect(await kindsFor(rep(2).auth, id)).toContain('RFQ_NOT_SELECTED');
      await produced(id);
      const delivered = await receive(id, admin.auth, await version(id, admin.auth));
      expect(delivered.status).toBe(200);
      expect(delivered.body.status).toBe('DELIVERED');
      const rated = await rate(id, rep(0).householdId, admin.auth, { stars: 5 });
      expect(rated.status).toBe(200);
      const read = await t.request({ method: 'GET', url: `/rfqs/${id}`, auth: admin.auth });
      expect(read.body.ratings).toHaveLength(1);
      expect(read.body.onBehalfOf.name).toBe(customer.name);
      // A delivered request made for a customer stays in the queue while ratings are open.
      const queue = await t.request({
        method: 'GET',
        url: '/admin/coordination',
        auth: admin.auth,
      });
      expect(queue.body.some((r: { id: string }) => r.id === id)).toBe(true);
      // Another administrator cannot rate it.
      expect((await rate(id, rep(1).householdId, otherAdmin.auth, { stars: 1 })).status).toBe(404);
    });
  });
});
