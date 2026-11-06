import type { AccountRole } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { routeInventory } from '../../src/common/auth/route-inventory';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #97 (PLAN E14, ARCHITECTURE §8.2): walks every API route from the inventory and checks the guard
 * over HTTP on a real app: no token gives 401 on every non-public route, and each role a route does not
 * allow gives 403. Path parameters get placeholder values; the guard runs before any pipe or handler.
 */
const routes = routeInventory(AppModule);
const PLACEHOLDER_ID = '00000000-0000-4000-8000-00000000f00d';
const ACCOUNT_ROLES: readonly AccountRole[] = ['BUYER', 'HOUSEHOLD', 'ADMIN'];

function concrete(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .replace(/:(\w+)/g, (_, name: string) =>
      /id$/i.test(name) || name === 'owner' || name === 'asset' ? PLACEHOLDER_ID : 'placeholder',
    );
}

describe('Route policy over HTTP', () => {
  let db: TestDatabase;
  let t: TestApp;
  const auth = {} as Record<AccountRole, string>;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    for (const role of ACCOUNT_ROLES) auth[role] = (await t.createUser(role)).auth;
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('answers 401 without a token on every non-public route', async () => {
    const failures: string[] = [];
    for (const route of routes.filter((r) => r.policy.kind !== 'PUBLIC')) {
      const res = await t.request({
        method: route.method as 'GET',
        url: concrete(route.path),
        ...(route.method === 'GET' || route.method === 'DELETE' ? {} : { body: {} }),
      });
      if (res.status !== 401) failures.push(`${route.method} ${route.path} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('answers 403 to every role a route does not allow', async () => {
    const failures: string[] = [];
    for (const route of routes) {
      const { policy } = route;
      if (policy.kind !== 'ROLES') continue;
      for (const role of ACCOUNT_ROLES.filter((r) => !policy.roles.includes(r))) {
        const res = await t.request({
          method: route.method as 'GET',
          url: concrete(route.path),
          auth: auth[role],
          ...(route.method === 'GET' || route.method === 'DELETE' ? {} : { body: {} }),
        });
        if (res.status !== 403)
          failures.push(`${role} ${route.method} ${route.path} → ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
