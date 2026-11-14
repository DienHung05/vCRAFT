// Tests for scripts/demo/lib/demo-session.mjs (GH#480). Run: pnpm test:scripts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  base32Decode,
  canMintSession,
  DEMO_ADMIN_EMAIL,
  DEMO_EMAILS,
  DemoSessionError,
  mintDemoSession,
  supabaseSettingsFromEnv,
  totp,
} from './demo-session.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// RFC 4648 base32 of the RFC 6238 SHA-1 test secret "12345678901234567890".
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

const BASE = {
  supabaseUrl: 'https://abc.supabase.co/',
  publishableKey: 'sb_publishable_test',
  secretKey: 'sb_secret_test',
};

/** A scripted fake of Supabase Auth: records requests, answers by method and path. */
function fakeAuth({ factors = [], failAt } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const { pathname } = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method, pathname, headers: init.headers, body });
    const reply = (status, json) => ({
      ok: status < 400,
      status,
      text: async () => JSON.stringify(json),
    });
    if (failAt === pathname) return reply(400, { error_code: 'captcha_failed' });
    if (pathname === '/auth/v1/admin/generate_link') return reply(200, { hashed_token: 'hash-1' });
    if (pathname === '/auth/v1/verify') {
      return reply(200, { access_token: 'aal1-token', refresh_token: 'refresh-1', user: {} });
    }
    if (pathname === '/auth/v1/user') return reply(200, { factors });
    if (pathname.endsWith('/challenge')) return reply(200, { id: 'challenge-1' });
    if (pathname.endsWith('/verify')) {
      return reply(200, { access_token: 'aal2-token', refresh_token: 'refresh-2', user: {} });
    }
    return reply(404, {});
  };
  return { calls, fetchImpl };
}

describe('TOTP (RFC 6238, SHA-1)', () => {
  // RFC 6238 appendix B, 8-digit vectors.
  const vectors = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [seconds, expected] of vectors) {
    it(`matches the RFC vector at T=${seconds}`, () => {
      assert.equal(totp(RFC_SECRET, { nowMs: seconds * 1000, digits: 8 }), expected);
      assert.equal(totp(RFC_SECRET, { nowMs: seconds * 1000 }), expected.slice(-6));
    });
  }

  it('decodes base32 ignoring case, spaces and padding', () => {
    assert.equal(base32Decode('mzxw 6ytb oi======').toString('utf8'), 'foobar');
  });

  it('rejects a secret that is not base32', () => {
    assert.throws(() => base32Decode('abc1!'), DemoSessionError);
  });
});

describe('mintDemoSession', () => {
  it('keeps the allowlist in sync with the seeded demo accounts', async () => {
    const accounts = await import(
      pathToFileURL(join(ROOT, 'packages/database/src/seeders/demo/accounts.ts')).href
    );
    assert.deepEqual(
      [...DEMO_EMAILS].sort(),
      accounts.DEMO_ACCOUNT_LIST.map((account) => account.email).sort(),
    );
    assert.equal(DEMO_ADMIN_EMAIL, accounts.DEMO_ACCOUNTS.admin.email);
  });

  it('refuses any other email before making a request', async () => {
    const { calls, fetchImpl } = fakeAuth();
    await assert.rejects(
      mintDemoSession({ ...BASE, email: 'someone.else@example.com', fetchImpl }),
      /only the fixed demo accounts/,
    );
    assert.equal(calls.length, 0);
  });

  it('mints a session through generate_link then verify (buyer: no MFA)', async () => {
    const { calls, fetchImpl } = fakeAuth();
    const session = await mintDemoSession({
      ...BASE,
      email: 'Demo.Buyer@example.com',
      fetchImpl,
    });
    assert.equal(session.access_token, 'aal1-token');
    assert.equal(calls.length, 2);
    const [link, verify] = calls;
    assert.equal(link.method, 'POST');
    assert.equal(link.pathname, '/auth/v1/admin/generate_link');
    assert.equal(link.headers.apikey, 'sb_secret_test');
    assert.equal(link.headers.authorization, 'Bearer sb_secret_test');
    assert.deepEqual(link.body, { type: 'magiclink', email: 'demo.buyer@example.com' });
    assert.equal(verify.pathname, '/auth/v1/verify');
    assert.equal(verify.headers.apikey, 'sb_publishable_test');
    assert.equal(verify.headers.authorization, undefined);
    assert.deepEqual(verify.body, { type: 'magiclink', token_hash: 'hash-1' });
  });

  it('upgrades the admin session to aal2 with the computed TOTP code', async () => {
    const { calls, fetchImpl } = fakeAuth({
      factors: [
        { id: 'unverified', factor_type: 'totp', status: 'unverified' },
        { id: 'factor-1', factor_type: 'totp', status: 'verified' },
      ],
    });
    const nowMs = 1111111111 * 1000;
    const session = await mintDemoSession({
      ...BASE,
      email: DEMO_ADMIN_EMAIL,
      totpSecret: RFC_SECRET,
      fetchImpl,
      now: () => nowMs,
    });
    assert.equal(session.access_token, 'aal2-token');
    assert.deepEqual(
      calls.map((call) => `${call.method} ${call.pathname}`),
      [
        'POST /auth/v1/admin/generate_link',
        'POST /auth/v1/verify',
        'GET /auth/v1/user',
        'POST /auth/v1/factors/factor-1/challenge',
        'POST /auth/v1/factors/factor-1/verify',
      ],
    );
    assert.equal(calls[2].headers.authorization, 'Bearer aal1-token');
    assert.equal(calls[3].headers.authorization, 'Bearer aal1-token');
    assert.deepEqual(calls[4].body, { challenge_id: 'challenge-1', code: '050471' });
  });

  it('waits for the next time step instead of replaying a TOTP code', async () => {
    const make = () =>
      fakeAuth({ factors: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }] });
    const slept = [];
    const sleep = async (ms) => slept.push(ms);
    const first = make();
    await mintDemoSession({
      ...BASE,
      email: DEMO_ADMIN_EMAIL,
      totpSecret: RFC_SECRET,
      fetchImpl: first.fetchImpl,
      now: () => 2000000000 * 1000,
      sleep,
    });
    // 2000000000 s is 20 s into its step (2000000000 % 30 = 20): 10 s left + 0.5 s margin.
    const second = make();
    await mintDemoSession({
      ...BASE,
      email: DEMO_ADMIN_EMAIL,
      totpSecret: RFC_SECRET,
      fetchImpl: second.fetchImpl,
      now: () => 2000000000 * 1000,
      sleep,
    });
    assert.deepEqual(slept, [10500]);
  });

  it('fails clearly when DEMO_ADMIN_TOTP_SECRET is missing (admin only)', async () => {
    const { calls, fetchImpl } = fakeAuth();
    await assert.rejects(
      mintDemoSession({ ...BASE, email: DEMO_ADMIN_EMAIL, fetchImpl }),
      /Missing DEMO_ADMIN_TOTP_SECRET/,
    );
    assert.equal(calls.length, 0);
  });

  it('fails clearly when the admin has no verified TOTP factor', async () => {
    const { fetchImpl } = fakeAuth({ factors: [] });
    await assert.rejects(
      mintDemoSession({
        ...BASE,
        email: DEMO_ADMIN_EMAIL,
        totpSecret: RFC_SECRET,
        fetchImpl,
        now: () => 3000000000 * 1000,
      }),
      /no verified TOTP factor/,
    );
  });

  it('names the missing Supabase settings', async () => {
    const email = 'demo.buyer@example.com';
    await assert.rejects(mintDemoSession({ ...BASE, email, supabaseUrl: '' }), /SUPABASE_URL/);
    await assert.rejects(
      mintDemoSession({ ...BASE, email, publishableKey: '' }),
      /SUPABASE_PUBLISHABLE_KEY/,
    );
    await assert.rejects(mintDemoSession({ ...BASE, email, secretKey: '' }), /SUPABASE_SECRET_KEY/);
  });

  it('reports the HTTP status without leaking tokens', async () => {
    const { fetchImpl } = fakeAuth({ failAt: '/auth/v1/verify' });
    await assert.rejects(
      mintDemoSession({ ...BASE, email: 'demo.buyer@example.com', fetchImpl }),
      (error) => {
        assert.match(error.message, /verify failed: HTTP 400 captcha_failed/);
        assert.doesNotMatch(error.message, /hash-1|sb_secret_test/);
        return true;
      },
    );
  });
});

describe('environment helpers', () => {
  it('detects the secret key and reads the settings with the NEXT_PUBLIC_ fallback', () => {
    assert.equal(canMintSession({}), false);
    assert.equal(canMintSession({ SUPABASE_SECRET_KEY: '  ' }), false);
    assert.equal(canMintSession({ SUPABASE_SECRET_KEY: 'k' }), true);
    assert.deepEqual(
      supabaseSettingsFromEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'pub',
        SUPABASE_SECRET_KEY: 'sec',
        DEMO_ADMIN_TOTP_SECRET: ' ABC ',
      }),
      {
        supabaseUrl: 'https://x.supabase.co',
        publishableKey: 'pub',
        secretKey: 'sec',
        totpSecret: 'ABC',
      },
    );
  });
});

describe('guard: the helper is script-only', () => {
  const SKIP = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      if (SKIP.has(name)) return [];
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

  it('is not referenced by any file under apps/ or packages/', () => {
    const offenders = ['apps', 'packages']
      .flatMap((dir) => walk(join(ROOT, dir)))
      .filter((file) => /\.(m?[jt]sx?|cjs|json)$/.test(file))
      .filter((file) => /demo-session\.mjs|scripts\/demo\/lib/.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders, []);
  });

  it('is forbidden by a dependency-cruiser rule', () => {
    const config = readFileSync(join(ROOT, '.config/dependency-cruiser.cjs'), 'utf8');
    assert.match(config, /apps-packages-no-scripts/);
  });
});
