import { AuditLog, Notification } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * vCRAFT-8my.2 — explicit applicant resubmission (FR-ADM-03): request-info flips the queue to
 * AWAITING_APPLICANT, the applicant edits and explicitly resubmits (optimistic-concurrency guarded),
 * the queue shows RESUBMITTED, the board receives an actionable HOUSEHOLD_RESUBMITTED notification,
 * and repeated or stale submissions are refused.
 */
describe('Household resubmission lifecycle', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let rep: { id: string; auth: string };
  let other: { auth: string };
  let buyer: { auth: string };
  let household: { id: string; version: number };

  const resubmit = (auth: string, version: number) =>
    t.request({
      method: 'POST',
      url: '/me/household/resubmit',
      auth,
      headers: { 'if-match': `"${version}"` },
    });
  const queue = async (query = 'status=PENDING_REVIEW') =>
    (await t.request({ method: 'GET', url: `/admin/households?${query}`, auth: admin.auth })).body
      .data;
  const decide = (action: string, version: number, body: object = {}) =>
    t.request({
      method: 'POST',
      url: `/admin/households/${household.id}/${action}`,
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body,
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    buyer = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Gửi Lại', slug: 'gom-gui-lai', history: 'Khai báo.' },
    });
    household = applied.body;
    await t.completeApplication(household.id);
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('authorization: buyer and another household cannot resubmit', async () => {
    // A buyer without a household is authenticated but owns nothing: 403 (roles/ownership), not 404.
    expect((await resubmit(buyer.auth, 1)).status).toBe(403);
    expect((await resubmit(other.auth, 1)).status).toBe(403);
    expect((await resubmit(admin.auth, 1)).status).toBe(403);
  });

  it('resubmit without an active information request is refused and the queue shows NEW', async () => {
    const res = await resubmit(rep.auth, household.version);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    const [row] = await queue();
    expect(row).toMatchObject({ id: household.id, reviewState: 'NEW', resubmittedAt: null });
  });

  it('request-info flips the queue to AWAITING_APPLICANT; the applicant sees the reason', async () => {
    const res = await decide('request-info', household.version, { reason: 'Thiếu giấy cư trú' });
    expect(res.status).toBe(200);
    household = res.body;
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.body).toMatchObject({
      status: 'PENDING_REVIEW',
      statusReason: 'Thiếu giấy cư trú',
      reviewState: 'AWAITING_APPLICANT',
      resubmittedAt: null,
    });
    const [row] = await queue();
    expect(row.reviewState).toBe('AWAITING_APPLICANT');
  });

  it('stale If-Match answers 409 without changing the record', async () => {
    const res = await resubmit(rep.auth, household.version - 1);
    expect(res.status).toBe(409);
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.body.reviewState).toBe('AWAITING_APPLICANT');
  });

  it('explicit resubmit clears the reason, marks the queue, notifies the board; audit keeps history', async () => {
    const res = await resubmit(rep.auth, household.version);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ reviewState: 'RESUBMITTED' });
    household.version = res.body.version;

    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.body).toMatchObject({
      status: 'PENDING_REVIEW',
      statusReason: null,
      reviewState: 'RESUBMITTED',
    });
    expect(mine.body.resubmittedAt).toEqual(expect.any(String));

    const [row] = await queue();
    expect(row).toMatchObject({ reviewState: 'RESUBMITTED', resubmittedAt: expect.any(String) });
    expect(row.status).toBe('PENDING_REVIEW');

    const em = db.orm.em.fork();
    const audit = await em.find(AuditLog, { entityId: household.id, action: 'household.resubmit' });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.before).toMatchObject({ reason: 'Thiếu giấy cư trú' });
    expect(audit[0]?.after).toMatchObject({ reason: null });

    const notices = await em.find(Notification, { type: 'HOUSEHOLD_RESUBMITTED' });
    expect(notices.map((n) => n.recipientId)).toContain(admin.id);
  });

  it('repeated resubmit without a new request is refused (INVALID_TRANSITION)', async () => {
    const res = await resubmit(rep.auth, household.version);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('a second request-info outranks the old marker; a rejected household cannot resubmit', async () => {
    const request = await decide('request-info', household.version, { reason: 'Ảnh chưa rõ' });
    expect(request.status).toBe(200);
    household = request.body;
    const [row] = await queue();
    expect(row.reviewState).toBe('AWAITING_APPLICANT');

    const res = await resubmit(rep.auth, household.version);
    expect(res.status).toBe(200);
    household.version = res.body.version;

    const rejected = await decide('reject', household.version, { reason: 'Không đủ điều kiện' });
    expect(rejected.status).toBe(200);
    household.version = rejected.body.version;
    expect((await resubmit(rep.auth, household.version)).status).toBe(409);
    expect(
      (await t.request({ method: 'GET', url: '/me/household', auth: rep.auth })).body,
    ).toMatchObject({
      status: 'REJECTED',
      reviewState: 'NEW',
    });
  });
});
