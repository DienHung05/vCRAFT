import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase, testDriver } from './support/test-database.js';

const GUARD_SQL = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../supabase/migrations/20261027134915_business_db_guard.sql',
);

/**
 * ADR-15: migration `business_db_guard` (event trigger bật RLS cho bảng mới trong `public`) phải chạy
 * TRƯỚC migration MikroORM. Chỉ PostgreSQL. Postgres thuần không có sẵn vai trò của Supabase nên
 * tạo giả `anon`/`authenticated` trong container (không đụng project Supabase thật).
 */
describe.skipIf(testDriver !== 'postgresql')('Supabase business_db_guard', () => {
  let db: TestDatabase;

  const query = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    db.orm.em.getConnection().execute(sql, params) as Promise<T[]>;

  const rlsEnabled = async (table: string): Promise<boolean> => {
    const rows = await query<{ relrowsecurity: boolean }>(
      'select relrowsecurity from pg_class where oid = ?::regclass',
      [`public.${table}`],
    );
    return rows[0]?.relrowsecurity === true;
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await query('create role anon nologin');
    await query('create role authenticated nologin');
    await query(readFileSync(GUARD_SQL, 'utf8'));
  });

  afterAll(async () => {
    await db?.stop();
  });

  it('bảng tạo sau khi guard có mặt tự bật RLS, kể cả bảng do migration MikroORM tạo', async () => {
    await query('create table plain_table (id int primary key)');
    expect(await rlsEnabled('plain_table')).toBe(true);

    await db.migrate();
    expect(await rlsEnabled('outbox_event')).toBe(true);
  });

  it('anon/authenticated không có quyền mặc định trên bảng mới', async () => {
    const rows = await query<{ anon_select: boolean; auth_select: boolean }>(
      `select has_table_privilege('anon', 'public.outbox_event', 'select') as anon_select,
              has_table_privilege('authenticated', 'public.outbox_event', 'select') as auth_select`,
    );
    expect(rows[0]).toEqual({ anon_select: false, auth_select: false });
  });
});
