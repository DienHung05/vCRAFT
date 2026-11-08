import { AccountInvitation, AppUser, AuditLog, LoginEvent } from '@vcraft/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

/**
 * GH#239: account administration. An administrator suspends and restores accounts (FR-AUTH-10: the
 * database status blocks the person at once and the Supabase identity is banned), invites people by email
 * (FR-AUTH-03: the invited address gets the role on its first verified sign-in), and a signed-in person
 * reviews their own sessions and signs the other ones out (FR-AUTH-05). Supabase is a fake; nothing here
 * reaches a real project.
 */
describe('Account administration', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  beforeEach(() => {
    t.authAdmin.failWith = null;
  });

  const audit = (action: string, entityId: string) =>
    db.orm.em.fork().find(AuditLog, { action, entityId });
  const statusOf = async (id: string) => (await db.orm.em.fork().findOneOrFail(AppUser, id)).status;

  describe('suspension (FR-AUTH-10)', () => {
    it('locks the account, bans the Supabase identity and writes an audit row', async () => {
      const buyer = await t.createUser('BUYER');
      const res = await t.request({
        method: 'POST',
        url: `/admin/users/${buyer.id}/suspend`,
        auth: admin.auth,
        body: { reason: '  Fake reviews on three products  ' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: buyer.id,
        status: 'LOCKED',
        statusReason: 'Fake reviews on three products',
      });
      const row = await db.orm.em.fork().findOneOrFail(AppUser, buyer.id);
      expect(row.status).toBe('LOCKED');
      expect(t.authAdmin.bannedIds.has(buyer.id)).toBe(true);
      const [entry] = await audit('user.suspend', buyer.id);
      expect(entry).toMatchObject({
        actorId: admin.id,
        entity: 'app_user',
        before: { status: 'ACTIVE', reason: null },
        after: { status: 'LOCKED', reason: 'Fake reviews on three products' },
      });
    });

    it('answers 403 AUTH_ACCOUNT_SUSPENDED on the next request, but still lets /me explain why', async () => {
      const buyer = await t.createUser('BUYER');
      expect(
        (await t.request({ method: 'GET', url: '/me/login-events', auth: buyer.auth })).status,
      ).toBe(200);
      await t.request({
        method: 'POST',
        url: `/admin/users/${buyer.id}/suspend`,
        auth: admin.auth,
        body: { reason: 'Abuse reports' },
      });

      const blocked = await t.request({ method: 'GET', url: '/me/login-events', auth: buyer.auth });
      expect(blocked.status).toBe(403);
      expect(blocked.body.code).toBe('AUTH_ACCOUNT_SUSPENDED');
      const write = await t.request({
        method: 'PUT',
        url: '/me/notification-preferences',
        auth: buyer.auth,
        body: { preferences: [] },
      });
      expect(write.status).toBe(403);
      expect(write.body.code).toBe('AUTH_ACCOUNT_SUSPENDED');

      const me = await t.request({ method: 'GET', url: '/me', auth: buyer.auth });
      expect(me.status).toBe(200);
      expect(me.body.status).toBe('LOCKED');
      // Public pages stay public for a token holder.
      expect(
        (await t.request({ method: 'GET', url: '/map/workshops', auth: buyer.auth })).status,
      ).toBe(200);
    });

    it('blocks a suspended administrator from the admin area too', async () => {
      const other = await t.createUser('ADMIN');
      await t.request({
        method: 'POST',
        url: `/admin/users/${other.id}/suspend`,
        auth: admin.auth,
        body: { reason: 'Left the board' },
      });
      const res = await t.request({ method: 'GET', url: '/admin/audit-log', auth: other.auth });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_ACCOUNT_SUSPENDED');
    });

    it('restores access, lifts the ban and writes an audit row on unsuspend', async () => {
      const buyer = await t.createUser('BUYER');
      await t.request({
        method: 'POST',
        url: `/admin/users/${buyer.id}/suspend`,
        auth: admin.auth,
        body: { reason: 'Abuse reports' },
      });
      const res = await t.request({
        method: 'POST',
        url: `/admin/users/${buyer.id}/unsuspend`,
        auth: admin.auth,
        body: { reason: 'Appeal accepted' },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'ACTIVE', statusReason: null });
      expect(t.authAdmin.bannedIds.has(buyer.id)).toBe(false);
      expect(
        (await t.request({ method: 'GET', url: '/me/login-events', auth: buyer.auth })).status,
      ).toBe(200);
      const [entry] = await audit('user.unsuspend', buyer.id);
      expect(entry).toMatchObject({
        actorId: admin.id,
        before: { status: 'LOCKED', reason: 'Abuse reports' },
        after: { status: 'ACTIVE', reason: 'Appeal accepted' },
      });
    });

    it('needs a reason, an administrator, another account and a state that can change', async () => {
      const buyer = await t.createUser('BUYER');
      const url = (id: string, action: string) => `/admin/users/${id}/${action}`;
      expect(
        (
          await t.request({
            method: 'POST',
            url: url(buyer.id, 'suspend'),
            auth: admin.auth,
            body: {},
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await t.request({
            method: 'POST',
            url: url(buyer.id, 'suspend'),
            auth: admin.auth,
            body: { reason: 'ab' },
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await t.request({
            method: 'POST',
            url: url(buyer.id, 'suspend'),
            auth: buyer.auth,
            body: { reason: 'Trying my luck' },
          })
        ).status,
      ).toBe(403);
      const self = await t.request({
        method: 'POST',
        url: url(admin.id, 'suspend'),
        auth: admin.auth,
        body: { reason: 'Testing the rule' },
      });
      expect(self.status).toBe(409);
      expect(self.body.code).toBe('BUSINESS_RULE_VIOLATED');
      expect(await statusOf(admin.id)).toBe('ACTIVE');
      expect(
        (
          await t.request({
            method: 'POST',
            url: url(crypto.randomUUID(), 'suspend'),
            auth: admin.auth,
            body: { reason: 'Nobody there' },
          })
        ).status,
      ).toBe(404);
      const notSuspended = await t.request({
        method: 'POST',
        url: url(buyer.id, 'unsuspend'),
        auth: admin.auth,
        body: {},
      });
      expect(notSuspended.status).toBe(409);
      expect(notSuspended.body.code).toBe('INVALID_TRANSITION');
      await t.request({
        method: 'POST',
        url: url(buyer.id, 'suspend'),
        auth: admin.auth,
        body: { reason: 'First time' },
      });
      const twice = await t.request({
        method: 'POST',
        url: url(buyer.id, 'suspend'),
        auth: admin.auth,
        body: { reason: 'Second time' },
      });
      expect(twice.status).toBe(409);
      expect(twice.body.code).toBe('INVALID_TRANSITION');
    });

    it('commits nothing when Supabase refuses the ban', async () => {
      const buyer = await t.createUser('BUYER');
      t.authAdmin.failWith = new Error('supabase down');
      const res = await t.request({
        method: 'POST',
        url: `/admin/users/${buyer.id}/suspend`,
        auth: admin.auth,
        body: { reason: 'Abuse reports' },
      });
      expect(res.status).toBe(500);
      expect(await statusOf(buyer.id)).toBe('ACTIVE');
      expect(await audit('user.suspend', buyer.id)).toHaveLength(0);
      expect(
        (await t.request({ method: 'GET', url: '/me/login-events', auth: buyer.auth })).status,
      ).toBe(200);
    });

    it('lists accounts for administrators only, filtered by status and search', async () => {
      const locked = await t.createUser('HOUSEHOLD');
      await t.request({
        method: 'POST',
        url: `/admin/users/${locked.id}/suspend`,
        auth: admin.auth,
        body: { reason: 'Duplicate profile' },
      });
      const outsider = await t.createUser('BUYER');
      expect(
        (await t.request({ method: 'GET', url: '/admin/users', auth: outsider.auth })).status,
      ).toBe(403);

      const byStatus = await t.request({
        method: 'GET',
        url: '/admin/users?status=LOCKED&role=HOUSEHOLD',
        auth: admin.auth,
      });
      expect(byStatus.status).toBe(200);
      expect(byStatus.body.items.map((u: { id: string }) => u.id)).toContain(locked.id);
      expect(byStatus.body.items.every((u: { status: string }) => u.status === 'LOCKED')).toBe(
        true,
      );
      const found = byStatus.body.items.find((u: { id: string }) => u.id === locked.id);
      expect(found.statusReason).toBe('Duplicate profile');

      const bySearch = await t.request({
        method: 'GET',
        url: `/admin/users?q=${encodeURIComponent(locked.email.toUpperCase())}`,
        auth: admin.auth,
      });
      expect(bySearch.body.items.map((u: { id: string }) => u.id)).toEqual([locked.id]);
    });
  });

  describe('invitations (FR-AUTH-03)', () => {
    const invite = (email: string, role: string, auth = admin.auth) =>
      t.request({ method: 'POST', url: '/admin/invitations', auth, body: { email, role } });
    const newSession = (extra = '') => {
      const sub = crypto.randomUUID();
      return { sub, auth: `Bearer test:${sub}${extra}` };
    };

    it('creates a pending invitation, sends the mail through the port and writes an audit row', async () => {
      const res = await invite('New.Admin@Example.com', 'ADMIN');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        email: 'new.admin@example.com',
        role: 'ADMIN',
        status: 'PENDING',
        acceptedAt: null,
      });
      expect(t.authAdmin.invites).toContainEqual({ email: 'new.admin@example.com', role: 'ADMIN' });
      const row = await db.orm.em
        .fork()
        .findOneOrFail(AccountInvitation, { email: 'new.admin@example.com' });
      expect(row).toMatchObject({ role: 'ADMIN', status: 'PENDING', invitedBy: admin.id });
      const [entry] = await audit('user.invite', row.id);
      expect(entry).toMatchObject({
        actorId: admin.id,
        entity: 'account_invitation',
        after: { email: 'new.admin@example.com', role: 'ADMIN', status: 'PENDING' },
      });
      const list = await t.request({ method: 'GET', url: '/admin/invitations', auth: admin.auth });
      expect(list.body.items.map((i: { email: string }) => i.email)).toContain(
        'new.admin@example.com',
      );
    });

    it('gives the invited role on the first verified sign-in and marks the invitation accepted', async () => {
      const email = `invited-${crypto.randomUUID()}@example.com`;
      await invite(email, 'HOUSEHOLD');
      const { sub, auth } = newSession(`|email=${email}`);
      const me = await t.request({ method: 'GET', url: '/me', auth });
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ id: sub, email, role: 'HOUSEHOLD' });
      const row = await db.orm.em.fork().findOneOrFail(AccountInvitation, { email });
      expect(row.status).toBe('ACCEPTED');
      expect(row.acceptedAt).toBeInstanceOf(Date);
    });

    it('keeps the admin second-factor rule for an invited administrator', async () => {
      const email = `invited-admin-${crypto.randomUUID()}@example.com`;
      await invite(email, 'ADMIN');
      const { auth } = newSession(`|aal=aal1|email=${email}`);
      const me = await t.request({ method: 'GET', url: '/me', auth });
      expect(me.body).toMatchObject({ role: 'ADMIN', mfaRequired: true });
      const area = await t.request({ method: 'GET', url: '/admin/audit-log', auth });
      expect(area.status).toBe(403);
      expect(area.body.code).toBe('AUTH_MFA_REQUIRED');
    });

    it('gives no role to an address Supabase has not verified, and leaves the invitation pending', async () => {
      const email = `unverified-${crypto.randomUUID()}@example.com`;
      await invite(email, 'ADMIN');
      const me = await t.request({
        method: 'GET',
        url: '/me',
        auth: newSession(`|verified=no|email=${email}`).auth,
      });
      expect(me.body.role).toBe('BUYER');
      const row = await db.orm.em.fork().findOneOrFail(AccountInvitation, { email });
      expect(row.status).toBe('PENDING');
    });

    it('gives an uninvited sign-in the buyer role as before', async () => {
      const me = await t.request({ method: 'GET', url: '/me', auth: newSession().auth });
      expect(me.body.role).toBe('BUYER');
    });

    it('resends to an address invited before and replaces the role without a second row', async () => {
      const email = `again-${crypto.randomUUID()}@example.com`;
      await invite(email, 'HOUSEHOLD');
      const again = await invite(email, 'ADMIN');
      expect(again.status).toBe(200);
      expect(again.body.role).toBe('ADMIN');
      expect(t.authAdmin.invites.filter((i) => i.email === email)).toHaveLength(2);
      expect(await db.orm.em.fork().count(AccountInvitation, { email })).toBe(1);
    });

    it('refuses an address that already has an account, here or on Supabase, and stores nothing', async () => {
      const buyer = await t.createUser('BUYER');
      const here = await invite(buyer.email, 'ADMIN');
      expect(here.status).toBe(409);
      expect(here.body.code).toBe('CONFLICT_DUPLICATE');

      const email = `confirmed-${crypto.randomUUID()}@example.com`;
      t.authAdmin.existingEmails.add(email);
      const there = await invite(email, 'ADMIN');
      expect(there.status).toBe(409);
      expect(there.body.code).toBe('CONFLICT_DUPLICATE');
      expect(await db.orm.em.fork().count(AccountInvitation, { email })).toBe(0);
    });

    it('stores nothing when Supabase cannot send the mail', async () => {
      const email = `outage-${crypto.randomUUID()}@example.com`;
      t.authAdmin.failWith = new Error('smtp down');
      expect((await invite(email, 'ADMIN')).status).toBe(500);
      expect(await db.orm.em.fork().count(AccountInvitation, { email })).toBe(0);
    });

    it('validates the email and offers only the household and administrator roles', async () => {
      expect((await invite('not-an-email', 'ADMIN')).status).toBe(422);
      expect((await invite('someone@example.com', 'BUYER')).status).toBe(422);
      expect((await invite('someone@example.com', 'OWNER')).status).toBe(422);
    });

    it('is closed to everyone but administrators', async () => {
      const household = await t.createUser('HOUSEHOLD');
      expect((await invite('x@example.com', 'ADMIN', household.auth)).status).toBe(403);
      expect(
        (await t.request({ method: 'GET', url: '/admin/invitations', auth: household.auth }))
          .status,
      ).toBe(403);
      expect((await t.request({ method: 'GET', url: '/admin/invitations' })).status).toBe(401);
    });
  });

  describe('sessions (FR-AUTH-05)', () => {
    const signIn = (
      user: { auth: string },
      session: string,
      headers: Record<string, string> = {},
    ) =>
      t.request({
        method: 'GET',
        url: '/me',
        auth: `${user.auth}|session=${session}|method=password`,
        headers,
      });

    it('records the browser and country of a session and flags the current one', async () => {
      const user = await t.createUser('BUYER');
      await signIn(user, 'sess-a', {
        'user-agent': CHROME_WINDOWS,
        'x-vercel-ip-country': 'VN',
      });
      await signIn(user, 'sess-b', { 'user-agent': FIREFOX_LINUX });

      const res = await t.request({
        method: 'GET',
        url: '/me/login-events',
        auth: `${user.auth}|session=sess-b|method=password`,
      });
      expect(res.status).toBe(200);
      const [newest, oldest] = res.body.items;
      expect(newest).toMatchObject({
        browser: 'Firefox · Linux',
        country: null,
        current: true,
        signedOutAt: null,
      });
      expect(oldest).toMatchObject({ browser: 'Chrome · Windows', country: 'VN', current: false });
    });

    it('lists only the signed-in person’s own sessions', async () => {
      const mine = await t.createUser('BUYER');
      const theirs = await t.createUser('BUYER');
      await signIn(mine, `mine-${mine.id}`);
      await signIn(theirs, `theirs-${theirs.id}`);

      const res = await t.request({
        method: 'GET',
        url: '/me/login-events',
        auth: `${mine.auth}|session=mine-${mine.id}`,
      });
      expect(res.body.items).toHaveLength(1);
      const stored = await db.orm.em.fork().find(LoginEvent, { userId: mine.id });
      expect(stored.map((row) => row.id)).toEqual(res.body.items.map((i: { id: string }) => i.id));
    });

    it('signs the other sessions out through the port and keeps this one', async () => {
      const user = await t.createUser('BUYER');
      const bystander = await t.createUser('BUYER');
      await signIn(user, 'keep-1');
      await signIn(user, 'other-1');
      await signIn(user, 'other-2');
      await signIn(bystander, 'bystander-1');
      const token = `${user.auth}|session=keep-1|method=password`;

      const res = await t.request({
        method: 'POST',
        url: '/me/sessions/sign-out-others',
        auth: token,
      });
      expect(res.status).toBe(200);
      // The port gets the caller's own access token, without the Bearer prefix.
      expect(t.authAdmin.signedOutOthers.at(-1)).toBe(token.replace('Bearer ', ''));
      expect(res.body.items).toHaveLength(3);
      const rows = await db.orm.em.fork().find(LoginEvent, { userId: user.id });
      for (const row of rows) {
        if (row.sessionId === 'keep-1') expect(row.revokedAt ?? null).toBeNull();
        else expect(row.revokedAt).toBeInstanceOf(Date);
      }
      expect(
        res.body.items.filter((i: { signedOutAt: string | null }) => i.signedOutAt),
      ).toHaveLength(2);
      expect(res.body.items.filter((i: { current: boolean }) => i.current)).toHaveLength(1);
      // Another person's session is not touched.
      const other = await db.orm.em.fork().findOneOrFail(LoginEvent, { sessionId: 'bystander-1' });
      expect(other.revokedAt ?? null).toBeNull();
    });

    it('marks nothing signed out when Supabase refuses', async () => {
      const user = await t.createUser('BUYER');
      await signIn(user, 'stay-1');
      await signIn(user, 'stay-2');
      t.authAdmin.failWith = new Error('supabase down');
      const res = await t.request({
        method: 'POST',
        url: '/me/sessions/sign-out-others',
        auth: `${user.auth}|session=stay-1`,
      });
      expect(res.status).toBe(500);
      const rows = await db.orm.em.fork().find(LoginEvent, { userId: user.id });
      expect(rows.every((row) => (row.revokedAt ?? null) === null)).toBe(true);
    });

    it('needs a signed-in person', async () => {
      expect(
        (await t.request({ method: 'POST', url: '/me/sessions/sign-out-others' })).status,
      ).toBe(401);
    });
  });
});
