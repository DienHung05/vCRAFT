import { AppUser } from '@vcraft/database';
import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthRateLimit } from '../../src/common/auth/auth-rate-limit.js';
import { PasswordIdentityProvider } from '../../src/common/auth/password-identity-provider.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

class FakePasswords extends PasswordIdentityProvider {
  calls: { email: string; password: string; captchaToken?: string }[] = [];
  async signIn(body: { email: string; password: string; captchaToken?: string }) {
    this.calls.push(body);
    if (body.email === 'buyer@example.com' && body.password === 'Password123')
      return { access_token: 'access', refresh_token: 'refresh' };
    if (body.email === 'buyer@example.com')
      await new Promise((resolve) => setTimeout(resolve, 1200));
    return null;
  }
  async signUp() {
    return { id: crypto.randomUUID(), email: 'new@example.com' };
  }
}

describe('Username authentication over HTTP', () => {
  let db: TestDatabase;
  let t: TestApp;
  const passwords = new FakePasswords();
  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db, (builder) =>
      builder
        .overrideProvider(PasswordIdentityProvider)
        .useValue(passwords)
        .overrideProvider(AuthRateLimit)
        .useValue({ check: async () => {} }),
    );
    const em = db.orm.em.fork();
    em.create(AppUser, {
      id: crypto.randomUUID(),
      email: 'buyer@example.com',
      username: 'pottery.buyer',
      role: 'BUYER',
    });
    await em.flush();
  });
  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('authenticates a case-insensitive username without returning its email', async () => {
    const response = await t.request({
      method: 'POST',
      url: '/auth/sign-in',
      body: { identifier: 'POTTERY.BUYER', password: 'Password123', captchaToken: 'captcha' },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ access_token: 'access', refresh_token: 'refresh' });
    expect(passwords.calls.at(-1)).toEqual({
      email: 'buyer@example.com',
      password: 'Password123',
      captchaToken: 'captcha',
    });
  });

  it('preserves email sign-in and returns the same generic failure for unknown usernames and wrong passwords', async () => {
    const email = await t.request({
      method: 'POST',
      url: '/auth/sign-in',
      body: { identifier: 'buyer@example.com', password: 'Password123' },
    });
    expect(email.status).toBe(200);
    const durations: number[] = [];
    for (const identifier of ['missing.buyer', 'pottery.buyer']) {
      const started = performance.now();
      const response = await t.request({
        method: 'POST',
        url: '/auth/sign-in',
        body: { identifier, password: 'WrongPassword123' },
      });
      durations.push(performance.now() - started);
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(JSON.stringify(response.body)).not.toContain('buyer@example.com');
    }
    expect(durations.every((duration) => duration >= 11_000)).toBe(true);
    expect(Math.abs((durations[0] ?? 0) - (durations[1] ?? 0))).toBeLessThan(500);
  }, 30_000);

  it('checks availability without accepting reserved names', async () => {
    for (const username of ['pottery.buyer', 'POTTERY.BUYER', 'admin']) {
      const response = await t.request({
        method: 'GET',
        url: `/auth/username-availability?username=${username}`,
      });
      expect(response.body).toEqual({ available: false });
    }
    expect(
      (await t.request({ method: 'GET', url: '/auth/username-availability?username=new.potter' }))
        .body,
    ).toEqual({ available: true });
  });

  it('lets an existing account choose a unique username but never a reserved one', async () => {
    const user = await t.createUser('BUYER');
    expect(
      (await t.request({ method: 'GET', url: '/me', auth: user.auth })).body.username,
    ).toBeNull();
    const reserved = await t.request({
      method: 'PUT',
      url: '/me/username',
      auth: user.auth,
      body: { username: 'ADMIN' },
    });
    expect(reserved.body.code).toBe('USERNAME_RESERVED');
    const taken = await t.request({
      method: 'PUT',
      url: '/me/username',
      auth: user.auth,
      body: { username: 'POTTERY.BUYER' },
    });
    expect(taken.body.code).toBe('USERNAME_TAKEN');
    expect(
      (
        await t.request({
          method: 'PUT',
          url: '/me/username',
          auth: user.auth,
          body: { username: 'Old.Buyer' },
        })
      ).status,
    ).toBe(200);
    expect((await t.request({ method: 'GET', url: '/me', auth: user.auth })).body.username).toBe(
      'old.buyer',
    );
  });

  it('reserves a username during sign-up before email confirmation or first login', async () => {
    const response = await t.request({
      method: 'POST',
      url: '/auth/sign-up',
      body: {
        username: 'New.Potter',
        email: 'new@example.com',
        password: 'Password123',
        privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      },
    });
    expect(response.status).toBe(200);
    expect(
      (await t.request({ method: 'GET', url: '/auth/username-availability?username=new.potter' }))
        .body.available,
    ).toBe(false);
  });
});
