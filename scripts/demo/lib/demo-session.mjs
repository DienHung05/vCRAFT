/**
 * Script-only session helper for the four fixed demo accounts (GH#480).
 *
 * Production enforces the Turnstile captcha on password sign-in and TOTP (aal2) for admins, so the demo
 * tooling (`pnpm demo:e2e`, `demo:e2e:preexam`, `demo:check:concurrency`) cannot sign in with a password.
 * This helper mints a session with the Supabase SECRET key instead, without weakening production:
 *
 *   1. `POST /auth/v1/admin/generate_link` {type:'magiclink', email}  (secret key) -> `hashed_token`
 *   2. `POST /auth/v1/verify` {type:'magiclink', token_hash}          (publishable key) -> session (aal1)
 *   3. admin only: `GET /auth/v1/user` -> TOTP factor id, then `POST /factors/{id}/challenge` and
 *      `POST /factors/{id}/verify` with the code computed from `DEMO_ADMIN_TOTP_SECRET` -> session (aal2)
 *
 * SAFETY: this file must never be reachable from the deployed API or web app. It lives under `scripts/`,
 * `.dependency-cruiser.cjs` forbids `apps/**` and `packages/**` from importing `scripts/`, and
 * `demo-session.test.mjs` fails when any source file under `apps/` or `packages/` mentions it. Only the
 * four allowlisted emails are accepted; anything else is refused BEFORE any request is made. Tokens are
 * never logged and never put in error messages.
 */
import { createHmac } from 'node:crypto';

/** The four fixed demo accounts (must match packages/database/src/seeders/demo/accounts.ts; the test checks it). */
export const DEMO_EMAILS = Object.freeze([
  'demo.admin@example.com',
  'demo.buyer@example.com',
  'demo.household@example.com',
  'demo.pending@example.com',
]);

/** The only account that needs the second factor (role ADMIN, `AUTH_ADMIN_MFA=required`). */
export const DEMO_ADMIN_EMAIL = 'demo.admin@example.com';

export class DemoSessionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DemoSessionError';
  }
}

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Decodes an RFC 4648 base32 string (spaces, dashes, padding and case ignored). */
export function base32Decode(input) {
  const clean = String(input)
    .replace(/[\s=-]/g, '')
    .toUpperCase();
  if (clean.length === 0) throw new DemoSessionError('TOTP secret is empty.');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) {
      throw new DemoSessionError('DEMO_ADMIN_TOTP_SECRET is not valid base32 (A-Z, 2-7).');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 0xff);
      value &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 6238 time step (counter) for a millisecond timestamp. */
export function totpStep(nowMs, period = 30) {
  return Math.floor(nowMs / 1000 / period);
}

/** RFC 6238 TOTP (HMAC-SHA1, 30 s step, 6 digits by default) from a base32 secret. */
export function totp(secretBase32, { nowMs = Date.now(), period = 30, digits = 6 } = {}) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(totpStep(nowMs, period)));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/** True when the machine has the secret key, i.e. the script-only path is available. */
export function canMintSession(env = process.env) {
  return Boolean(env.SUPABASE_SECRET_KEY?.trim());
}

/** Reads the Supabase settings the helper needs from the environment. */
export function supabaseSettingsFromEnv(env = process.env) {
  const pick = (...names) => names.map((name) => env[name]?.trim()).find(Boolean);
  return {
    supabaseUrl: pick('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'),
    publishableKey: pick('SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    secretKey: pick('SUPABASE_SECRET_KEY'),
    totpSecret: pick('DEMO_ADMIN_TOTP_SECRET'),
  };
}

/** Calls a Supabase Auth endpoint; errors carry the status and Supabase's error code, never a token. */
async function authRequest(fetchImpl, step, url, { method = 'POST', headers, body }) {
  const response = await fetchImpl(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = {};
  }
  if (!response.ok) {
    const code = json.error_code ?? json.code ?? '';
    throw new DemoSessionError(`${step} failed: HTTP ${response.status} ${code}`.trim());
  }
  return json;
}

let lastTotpStep = -1;

/**
 * Mints a Supabase session (the JSON `@supabase/ssr` stores in the cookie) for one demo account.
 *
 * @param {object} options
 * @param {string} options.email must be one of {@link DEMO_EMAILS}
 * @param {string} options.supabaseUrl
 * @param {string} options.publishableKey
 * @param {string} options.secretKey
 * @param {string} [options.totpSecret] base32 secret of the demo admin's TOTP factor (required for the admin)
 * @param {typeof fetch} [options.fetchImpl]
 * @param {() => number} [options.now] clock in ms (tests)
 * @param {(ms: number) => Promise<void>} [options.sleep] (tests)
 */
export async function mintDemoSession({
  email,
  supabaseUrl,
  publishableKey,
  secretKey,
  totpSecret,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  const normalized = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!DEMO_EMAILS.includes(normalized)) {
    throw new DemoSessionError(
      `Refusing to mint a session for "${normalized}": only the fixed demo accounts are allowed.`,
    );
  }
  if (!supabaseUrl) {
    throw new DemoSessionError('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
  }
  if (!publishableKey) {
    throw new DemoSessionError(
      'Missing SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).',
    );
  }
  if (!secretKey) {
    throw new DemoSessionError(
      'Missing SUPABASE_SECRET_KEY (needed only on the machine running the demo scripts).',
    );
  }
  const needsMfa = normalized === DEMO_ADMIN_EMAIL;
  if (needsMfa && !totpSecret) {
    throw new DemoSessionError(
      'Missing DEMO_ADMIN_TOTP_SECRET: the demo admin needs TOTP (aal2); see docs/demo/README.md section 7.',
    );
  }
  const base = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;

  const link = await authRequest(fetchImpl, 'generate_link', `${base}/admin/generate_link`, {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
    body: { type: 'magiclink', email: normalized },
  });
  const tokenHash = link.hashed_token ?? link.properties?.hashed_token;
  if (!tokenHash) {
    throw new DemoSessionError('generate_link failed: no hashed_token in the response.');
  }

  const session = await authRequest(fetchImpl, 'verify', `${base}/verify`, {
    headers: { apikey: publishableKey },
    body: { type: 'magiclink', token_hash: tokenHash },
  });
  if (!session.access_token || !session.refresh_token) {
    throw new DemoSessionError('verify failed: no session in the response.');
  }
  if (!needsMfa) return session;

  const bearer = { apikey: publishableKey, authorization: `Bearer ${session.access_token}` };
  const user = await authRequest(fetchImpl, 'get user', `${base}/user`, {
    method: 'GET',
    headers: bearer,
  });
  const factor = (user.factors ?? []).find(
    (candidate) => candidate.factor_type === 'totp' && candidate.status === 'verified',
  );
  if (!factor) {
    throw new DemoSessionError(
      'The demo admin has no verified TOTP factor: enrol one first (docs/demo/README.md section 7).',
    );
  }
  const challenge = await authRequest(
    fetchImpl,
    'mfa challenge',
    `${base}/factors/${factor.id}/challenge`,
    { headers: bearer, body: {} },
  );

  // A TOTP code is valid for one 30 s step; wait for the next step instead of replaying the previous code.
  let timeMs = now();
  if (totpStep(timeMs) === lastTotpStep) {
    await sleep(((totpStep(timeMs) + 1) * 30 - Math.floor(timeMs / 1000)) * 1000 + 500);
    timeMs = now();
  }
  lastTotpStep = totpStep(timeMs);
  const upgraded = await authRequest(
    fetchImpl,
    'mfa verify',
    `${base}/factors/${factor.id}/verify`,
    {
      headers: bearer,
      body: { challenge_id: challenge.id, code: totp(totpSecret, { nowMs: timeMs }) },
    },
  );
  if (!upgraded.access_token || !upgraded.refresh_token) {
    throw new DemoSessionError('mfa verify failed: no session in the response.');
  }
  return upgraded;
}

/** {@link mintDemoSession} with the settings read from the environment. */
export function mintDemoSessionFromEnv(email, overrides = {}) {
  return mintDemoSession({ email, ...supabaseSettingsFromEnv(), ...overrides });
}
