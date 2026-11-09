import { Household } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** GH#349: `GET /admin/households` is cursor-paged (oldest first) and the filters hold across pages. */
describe('Admin household list pagination', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  const ids: string[] = [];

  const page = async (query: string) => {
    const res = await t.request({
      method: 'GET',
      url: `/admin/households?${query}`,
      auth: admin.auth,
    });
    expect(res.status).toBe(200);
    return res.body as { data: { id: string; status: string }[]; nextCursor: string | null };
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    for (let i = 0; i < 5; i++) {
      const rep = await t.createUser('BUYER');
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: rep.auth,
        body: { name: `Gốm Trang ${i}`, slug: `gom-trang-${i}`, history: 'Khai báo.' },
      });
      ids.push(applied.body.id);
    }
    // Two of the five are already approved, so the status filter has something to exclude.
    const em = db.orm.em.fork();
    await em.nativeUpdate(Household, { id: { $in: [ids[1], ids[3]] } }, { status: 'APPROVED' });
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('walks every household in two pages without duplicates', async () => {
    const first = await page('limit=3');
    expect(first.data).toHaveLength(3);
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await page(`limit=3&cursor=${first.nextCursor}`);
    expect(second.data).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const seen = [...first.data, ...second.data].map((h) => h.id);
    expect(new Set(seen).size).toBe(5);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it('keeps the status filter across pages', async () => {
    const first = await page('status=PENDING_REVIEW&limit=2');
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const second = await page(`status=PENDING_REVIEW&limit=2&cursor=${first.nextCursor}`);
    expect(second.data).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const all = [...first.data, ...second.data];
    expect(all.every((h) => h.status === 'PENDING_REVIEW')).toBe(true);
    expect(all.map((h) => h.id)).not.toContain(ids[1]);
    expect(all.map((h) => h.id)).not.toContain(ids[3]);
  });

  it('rejects a malformed cursor', async () => {
    const res = await t.request({
      method: 'GET',
      url: '/admin/households?cursor=not-a-cursor',
      auth: admin.auth,
    });
    expect(res.status).toBe(400);
  });
});
