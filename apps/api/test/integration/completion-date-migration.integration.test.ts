import { randomUUID } from 'node:crypto';
import type { AbstractSqlDriver } from '@mikro-orm/sql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** GH#443: the migration moves stored midnight-UTC completion dates to the end of the Vietnam day. */
describe('completion date end-of-day migration', () => {
  let db: TestDatabase;
  const postgres = () => db.driver === 'postgresql';

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  const parts = (dates: string[]) =>
    JSON.stringify(
      dates.map((completionDate) => ({
        householdId: randomUUID(),
        quantity: 1,
        unitPriceVnd: 1,
        completionDate,
        contributionVersion: 1,
      })),
    );

  it('shifts midnight-UTC values on the offer column, offer history and quotation parts only', async () => {
    const offerId = randomUUID();
    const quotationId = randomUUID();
    const keptId = randomUUID();
    const midnight = '2026-11-20T00:00:00.000Z';
    const endOfDay = '2026-11-20T16:59:59.000Z';
    const other = '2026-11-21T03:30:00.000Z';

    const insert = async (
      conn: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
      stamp: (value: string) => string,
      json: string,
    ) => {
      const now = stamp('2026-11-01T00:00:00.000Z');
      const history = parts([midnight, other]);
      const keptDate = stamp(other);
      const offer = (id: string, date: string) =>
        conn.execute(
          `insert into contribution_offer (id, created_at, updated_at, version, request_id, household_id, max_quantity, unit_price_vnd, completion_date, status, history) values (?, ${now}, ${now}, 1, ?, ?, 1, 1, ${date}, 'ACTIVE', ${json})`,
          [id, randomUUID(), randomUUID(), history],
        );
      await offer(offerId, stamp(midnight));
      await offer(keptId, keptDate);
      await conn.execute(
        `insert into cooperative_quotation (id, created_at, updated_at, version, request_id, status, quantity, parts, production_total_vnd, additional_charge_vnd, total_vnd, delivery_terms, bid_type) values (?, ${now}, ${now}, 1, ?, 'SUBMITTED', 1, ${json}, 1, 0, 1, 'FOB', 'COOPERATIVE')`,
        [quotationId, randomUUID(), parts([midnight, other])],
      );
    };

    const stamp = (value: string) =>
      postgres() ? `'${value}'::timestamptz` : `'${value.replace('T', ' ').replace('Z', '')}'`;
    const json = postgres() ? '?::jsonb' : '?';

    const migration = postgres()
      ? new (
          await import(
            '../../../../packages/database/src/migrations/postgresql/Migration20261110140000_completion_date_end_of_day.js'
          )
        ).Migration20261110140000_completion_date_end_of_day(
          db.orm.em.getDriver() as AbstractSqlDriver,
          db.orm.config,
        )
      : new (
          await import(
            '../../../../packages/database/src/migrations/mysql/Migration20261110140001_completion_date_end_of_day.js'
          )
        ).Migration20261110140001_completion_date_end_of_day(
          db.orm.em.getDriver() as AbstractSqlDriver,
          db.orm.config,
        );

    await db.orm.em.fork().transactional(async (em) => {
      // The rows reference requests and households that this test does not create.
      await em
        .getConnection()
        .execute(
          postgres()
            ? 'set local session_replication_role = replica'
            : 'set foreign_key_checks = 0',
        );
      await insert(em.getConnection(), stamp, json);
      migration.setTransactionContext(em.getTransactionContext() as never);
      await migration.up();

      const conn = em.getConnection();
      const read = (table: string, column: string, id: string) =>
        conn.execute(`select ${column} as value from ${table} where id = ?`, [id]) as Promise<
          Array<{ value: unknown }>
        >;
      const dateText = postgres()
        ? `to_char(completion_date at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')`
        : `date_format(completion_date, '%Y-%m-%dT%H:%i:%s')`;

      const [offer] = await read('contribution_offer', dateText, offerId);
      const [kept] = await read('contribution_offer', dateText, keptId);
      expect(offer?.value).toBe('2026-11-20T16:59:59');
      expect(kept?.value).toBe('2026-11-21T03:30:00');

      const dates = async (table: string, column: string, id: string) => {
        const [row] = await read(table, column, id);
        const list = (
          typeof row?.value === 'string' ? JSON.parse(row.value) : row?.value
        ) as Array<{
          completionDate: string;
        }>;
        return list.map((entry) => entry.completionDate);
      };
      expect(await dates('contribution_offer', 'history', offerId)).toEqual([endOfDay, other]);
      expect(await dates('cooperative_quotation', 'parts', quotationId)).toEqual([endOfDay, other]);

      // Running it again changes nothing.
      await migration.up();
      expect(await dates('cooperative_quotation', 'parts', quotationId)).toEqual([endOfDay, other]);
      expect((await read('contribution_offer', dateText, offerId))[0]?.value).toBe(
        '2026-11-20T16:59:59',
      );
    });
  });
});
