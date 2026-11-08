import {
  dueRequestIds,
  expireRequest,
  flagRequestsNeedingCoordination,
  OutboxEvent,
  QuotationNotice,
  QuotationRequest,
} from '@vcraft/database';
import { RFQ_ACCEPT_GRACE_MS } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #89: the `rfq.expire` and `rfq.coordination-check` jobs on a real database. The worker only
 * calls these functions, so they are exercised here directly, with a `now` past the deadline.
 */
describe('Scheduled quotation jobs', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { id: string; auth: string };
  let admin: { id: string; auth: string };
  let reps: Array<{ id: string; auth: string; householdId: string }>;
  const DAY = 86_400_000;

  async function sentRequest(opts: { closesInMs?: number; coordinationOptIn?: boolean } = {}) {
    const biddingClosesAt = new Date(Date.now() + (opts.closesInMs ?? 2 * DAY)).toISOString();
    const created = await t.request({
      method: 'POST',
      url: '/rfqs',
      auth: buyer.auth,
      body: {
        design: 'Logo cups',
        quantity: 1000,
        unit: 'cup',
        destination: 'Ha Noi',
        requiredBy: new Date(Date.now() + 30 * DAY).toISOString(),
        biddingClosesAt,
        invitedHouseholdIds: reps.map((rep) => rep.householdId),
        coordinationOptIn: opts.coordinationOptIn ?? false,
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
    return { id: sent.body.id as string, closesAt: new Date(biddingClosesAt) };
  }

  const later = (date: Date, ms = 1_000) => new Date(date.getTime() + ms);
  const noticesFor = (requestId: string, kind: string) =>
    db.orm.em.fork().find(QuotationNotice, { requestId, kind: kind as never });
  const statusOf = async (id: string) =>
    (await db.orm.em.fork().findOneOrFail(QuotationRequest, id)).status;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
    admin = await t.createUser('ADMIN');
    reps = [];
    for (const name of ['a', 'b']) {
      const user = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Schedule ${name}`, slug: `schedule-household-${name}`, history: '' },
      });
      await t.request({
        method: 'POST',
        url: `/admin/households/${applied.body.id}/approve`,
        auth: admin.auth,
        headers: { 'if-match': String(applied.body.version) },
      });
      reps.push({ ...user, householdId: applied.body.id });
    }
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('submitting writes the event the worker schedules rfq.expire from', async () => {
    const { id, closesAt } = await sentRequest();
    const events = await db.orm.em.fork().find(OutboxEvent, { type: 'rfq.submitted' });
    expect(events.map((e) => e.payload)).toContainEqual({
      requestId: id,
      biddingClosesAt: closesAt.toISOString(),
    });
  });

  it('a request without offers expires at the deadline and everyone is told once', async () => {
    const { id, closesAt } = await sentRequest();
    expect(await expireRequest(db.orm, id, new Date(closesAt.getTime() - 1_000))).toBe('UNCHANGED');
    expect(await dueRequestIds(db.orm, later(closesAt))).toContain(id);

    expect(await expireRequest(db.orm, id, later(closesAt))).toBe('EXPIRED');
    expect(await statusOf(id)).toBe('EXPIRED');
    const notices = await noticesFor(id, 'RFQ_EXPIRED');
    expect(notices.map((n) => n.recipientId).sort()).toEqual(
      [buyer.id, ...reps.map((r) => r.id)].sort(),
    );

    // A retried or duplicate job changes nothing.
    expect(await expireRequest(db.orm, id, later(closesAt, 5_000))).toBe('UNCHANGED');
    expect(await noticesFor(id, 'RFQ_EXPIRED')).toHaveLength(notices.length);
    expect(await dueRequestIds(db.orm, later(closesAt, 5_000))).not.toContain(id);
  });

  it('a request with offers closes for bidding, then expires after the accept window', async () => {
    const { id, closesAt } = await sentRequest();
    const offer = await t.request({
      method: 'POST',
      url: `/rfqs/${id}/contributions`,
      auth: reps[0]?.auth as string,
      body: {
        maxQuantity: 500,
        unitPriceVnd: 40_000,
        completionDate: new Date(Date.now() + 10 * DAY).toISOString(),
      },
    });
    expect(offer.status).toBe(201);
    // A cooperative quotation moves the request to BIDDING; set it directly to keep the test focused.
    await db.orm.em.fork().nativeUpdate(QuotationRequest, { id }, { status: 'BIDDING' });

    expect(await expireRequest(db.orm, id, later(closesAt))).toBe('BIDDING_CLOSED');
    expect(await statusOf(id)).toBe('BIDDING');
    expect(await noticesFor(id, 'BIDDING_CLOSED')).toHaveLength(3);
    expect(await expireRequest(db.orm, id, later(closesAt, 2_000))).toBe('UNCHANGED');
    expect(await noticesFor(id, 'BIDDING_CLOSED')).toHaveLength(3);

    const graceOver = later(closesAt, RFQ_ACCEPT_GRACE_MS + 1_000);
    expect(await dueRequestIds(db.orm, graceOver)).toContain(id);
    expect(await expireRequest(db.orm, id, graceOver)).toBe('EXPIRED');
    expect(await statusOf(id)).toBe('EXPIRED');
  });

  it('flags an unclaimed opt-in request near its deadline once and tells the admins', async () => {
    const { id } = await sentRequest({ closesInMs: 36 * 60 * 60 * 1000, coordinationOptIn: true });
    const flagged = await flagRequestsNeedingCoordination(db.orm);
    expect(flagged).toContain(id);
    const notices = await noticesFor(id, 'COORDINATION_NEEDED');
    expect(notices.map((n) => n.recipientId)).toContain(admin.id);
    expect(await flagRequestsNeedingCoordination(db.orm)).not.toContain(id);
    expect(await noticesFor(id, 'COORDINATION_NEEDED')).toHaveLength(notices.length);
  });

  it('flags a request closing within a day whose offers cannot cover the quantity', async () => {
    const far = await sentRequest({ closesInMs: 5 * DAY });
    // Buyers cannot submit a deadline under 24 h (SRS T1), so the request gets close to it with time.
    const near = await sentRequest();
    const em = db.orm.em.fork();
    const nearRequest = await em.findOneOrFail(QuotationRequest, near.id);
    nearRequest.biddingClosesAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await em.flush();
    const flagged = await flagRequestsNeedingCoordination(db.orm);
    expect(flagged).toContain(near.id);
    expect(flagged).not.toContain(far.id);
  });

  it('does not flag a closing request that already has a complete household quotation', async () => {
    const quoted = await sentRequest();
    const em = db.orm.em.fork();
    const request = await em.findOneOrFail(QuotationRequest, quoted.id);
    request.biddingClosesAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await em.flush();
    // The household quotes the whole quantity on its own: it has no contribution offer to count.
    const quote = await t.request({
      method: 'POST',
      url: `/rfqs/${quoted.id}/direct-quotations`,
      auth: reps[0]?.auth,
      body: {
        unitPriceVnd: 30_000,
        completionDate: new Date(Date.now() + 20 * DAY).toISOString(),
      },
    });
    expect(quote.status).toBe(201);
    expect(await flagRequestsNeedingCoordination(db.orm)).not.toContain(quoted.id);
  });
});
