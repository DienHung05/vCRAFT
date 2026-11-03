import { LoginEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#83: an admin session that has not passed TOTP (`aal1`) is refused on admin routes with
 * `AUTH_MFA_REQUIRED`, while `GET /me` tells the web to show the code screen. Every new Supabase session
 * is recorded once as a sign-in for the account security page.
 */
describe('Admin MFA and sign-in history', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string; id: string };
  let buyer: { auth: string; id: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('refuses an aal1 admin session on admin routes', async () => {
    const res = await t.request({
      method: 'GET',
      url: '/admin/audit-log',
      auth: `${admin.auth}|aal=aal1`,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_MFA_REQUIRED');
  });

  it('lets the same admin in once the session reached aal2', async () => {
    const res = await t.request({ method: 'GET', url: '/admin/audit-log', auth: admin.auth });
    expect(res.status).toBe(200);
  });

  it('tells the web an aal1 admin must pass the second factor, and nobody else', async () => {
    const pending = await t.request({ method: 'GET', url: '/me', auth: `${admin.auth}|aal=aal1` });
    expect(pending.status).toBe(200);
    expect(pending.body.mfaRequired).toBe(true);
    const done = await t.request({ method: 'GET', url: '/me', auth: admin.auth });
    expect(done.body.mfaRequired).toBe(false);
    const shopper = await t.request({ method: 'GET', url: '/me', auth: `${buyer.auth}|aal=aal1` });
    expect(shopper.body.mfaRequired).toBe(false);
  });

  it('records each session once and lists it newest first', async () => {
    const first = `${buyer.auth}|aal=aal1|session=sess-buyer-1|method=password`;
    await t.request({ method: 'GET', url: '/me', auth: first });
    await t.request({ method: 'GET', url: '/me', auth: first });
    await t.request({
      method: 'GET',
      url: '/me',
      auth: `${buyer.auth}|aal=aal1|session=sess-buyer-2|method=oauth`,
    });
    const rows = await db.orm.em.fork().find(LoginEvent, { userId: buyer.id });
    expect(rows).toHaveLength(2);

    const res = await t.request({ method: 'GET', url: '/me/login-events', auth: buyer.auth });
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: { method: string }) => e.method)).toEqual(['oauth', 'password']);
  });

  it('marks a session as aal2 once it passes TOTP', async () => {
    await t.request({
      method: 'GET',
      url: '/me',
      auth: `${admin.auth}|aal=aal1|session=sess-admin-1|method=password`,
    });
    await t.request({
      method: 'GET',
      url: '/me',
      auth: `${admin.auth}|aal=aal2|session=sess-admin-1|method=password`,
    });
    const row = await db.orm.em.fork().findOneOrFail(LoginEvent, { sessionId: 'sess-admin-1' });
    expect(row.aal).toBe('aal2');
  });

  it("never shows one account's sign-ins to another", async () => {
    const res = await t.request({ method: 'GET', url: '/me/login-events', auth: admin.auth });
    expect(res.body.items.every((e: { method: string }) => e.method === 'password')).toBe(true);
    expect(res.body.items).toHaveLength(1);
  });
});
