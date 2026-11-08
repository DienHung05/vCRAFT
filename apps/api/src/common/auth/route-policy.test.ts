import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { type RouteEntry, routeInventory } from './route-inventory';

const routes = routeInventory(AppModule);
const line = (r: RouteEntry) =>
  `${r.method} ${r.path} ${r.policy.kind === 'ROLES' ? `ROLES(${[...r.policy.roles].sort().join(',')})` : r.policy.kind}`;

/** Public routes that change state; each one is reviewed and listed here on purpose. */
const PUBLIC_WRITES = new Set([
  // Password endpoints verify Turnstile upstream and share Redis limits across API instances.
  'POST /api/v1/auth/sign-in',
  'POST /api/v1/auth/sign-up',
  // A QR scan is counted anonymously (FR-ADM-06); it stores the product, the time and an optional country and device class (never an IP).
  'POST /api/v1/trace/:code/scan',
  // The Fox assistant answers guests (PLAN E15): rate limited per hashed IP, logged anonymously.
  'POST /api/v1/assistant/messages',
  'POST /api/v1/assistant/messages/:id/feedback',
  // Provider callbacks of online payment (ADR-0021): not signed-in users, so each is checked by the provider's own
  // credential (SePay API key header) or HMAC signature (MoMo IPN) and applied idempotently.
  'POST /api/v1/payments/webhooks/sepay',
  'POST /api/v1/payments/webhooks/momo',
]);

/**
 * PLAN E14 / ARCHITECTURE §8.2: every API route, enumerated from decorator metadata, with the policy the
 * global `AuthGuard` applies. The snapshot makes any new route, or any change to who may call one, show
 * up in review; the rules below fail outright on the dangerous cases.
 */
describe('API route policy', () => {
  it('finds the routes of every module', () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(new Set(routes.map((r) => `${r.method} ${r.path}`)).size).toBe(routes.length);
  });

  it('matches the reviewed inventory', () => {
    expect(routes.map(line).join('\n')).toMatchSnapshot();
  });

  it('keeps public routes read-only except the reviewed writes', () => {
    const writes = routes
      .filter((r) => r.policy.kind === 'PUBLIC' && r.method !== 'GET')
      .map((r) => `${r.method} ${r.path}`);
    expect(writes.filter((w) => !PUBLIC_WRITES.has(w))).toEqual([]);
  });

  it('allows only administrators on /admin routes', () => {
    const loose = routes.filter(
      (r) =>
        r.path.startsWith('/api/v1/admin') &&
        !(
          r.policy.kind === 'ROLES' &&
          r.policy.roles.length === 1 &&
          r.policy.roles[0] === 'ADMIN'
        ),
    );
    expect(loose.map(line)).toEqual([]);
  });

  it('never exposes an account route (/me) without signing in', () => {
    expect(
      routes
        .filter((r) => /^\/api\/v1\/me(\/|$)/.test(r.path) && r.policy.kind === 'PUBLIC')
        .map(line),
    ).toEqual([]);
  });
});
