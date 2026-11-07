import { AppUser, FieldCipher, seedDemoData } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_FIELD_KEYS } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#212 — DB enforcement of app_user.username on both drivers: unique, lowercase-only (case
 * sensitive CHECK), nullable for existing users, and the demo backfill applied by the migration.
 */
describe('app_user.username database enforcement', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  });

  afterAll(async () => {
    await db?.stop();
  });

  /** Raw insert bypassing the entity lifecycle, like a row written through another code path. */
  const rawInsert = (values: Record<string, unknown>) => {
    const em = db.orm.em.fork();
    return em
      .getConnection()
      .execute(
        `insert into app_user (id, email, role, status, version, username, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          values.id,
          values.email,
          values.role ?? 'BUYER',
          values.status ?? 'ACTIVE',
          values.version ?? 1,
          values.username ?? null,
          new Date(),
          new Date(),
        ],
      );
  };

  const DEMO_ROW = { role: 'BUYER', status: 'ACTIVE', version: 1 };

  it('accepts a lowercase username and rejects an uppercase one', async () => {
    await rawInsert({
      ...DEMO_ROW,
      email: 'check@example.com',
      id: '11111111-1111-4111-8111-111111111101',
      username: 'an.nguyen',
    });
    await expect(
      rawInsert({
        ...DEMO_ROW,
        email: 'upper@example.com',
        id: '11111111-1111-4111-8111-111111111102',
        username: 'An.Nguyen',
      }),
    ).rejects.toThrow();
  });

  it('rejects a username that is too short or has forbidden characters', async () => {
    await expect(
      rawInsert({
        email: 'short@example.com',
        id: '11111111-1111-4111-8111-111111111103',
        username: 'ab',
      }),
    ).rejects.toThrow();
    await expect(
      rawInsert({
        email: 'bad@example.com',
        id: '11111111-1111-4111-8111-111111111104',
        username: 'bad name!',
      }),
    ).rejects.toThrow();
  });

  it('allows many accounts without a username (existing users stay null)', async () => {
    for (const i of [1, 2, 3]) {
      await rawInsert({
        email: `null-${i}@example.com`,
        id: `11111111-2222-4111-8111-11111111110${i}`,
      });
    }
    const em = db.orm.em.fork();
    expect(await em.count(AppUser, { username: null })).toBeGreaterThanOrEqual(3);
  });

  it('rejects a duplicate username (unique index)', async () => {
    await rawInsert({
      email: 'dup1@example.com',
      id: '11111111-3333-4111-8111-111111111101',
      username: 'dupe.check',
    });
    await expect(
      rawInsert({
        email: 'dup2@example.com',
        id: '11111111-3333-4111-8111-111111111102',
        username: 'dupe.check',
      }),
    ).rejects.toThrow();
  });

  it('seed backfilled the four demo accounts with unique usernames (fresh seed, not just migration)', async () => {
    const em = db.orm.em.fork();
    await em.transactional(async (tx) => {
      await tx.nativeDelete(AppUser, {});
      await seedDemoData(tx, { cipher: new FieldCipher(TEST_FIELD_KEYS) });
    });
    const users = await em.find(AppUser, { username: { $ne: null } });
    const usernames = users.map((u) => u.username as string);
    expect(new Set(usernames).size).toBe(usernames.length);
    for (const name of ['admin', 'buyer', 'household', 'pending']) {
      expect(usernames).toContain(name);
    }
    // GH#212: representatives of the 19 seeded households get a handle derived from the household slug.
    expect(usernames).toContain('rep-gom-minh-hai');
  });
});
