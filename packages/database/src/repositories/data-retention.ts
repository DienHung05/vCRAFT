import type { MikroORM } from '@mikro-orm/core';
import { LoginEvent } from '../entities/login-event.entity.js';
import { TraceScan } from '../entities/trace-scan.entity.js';

/** Sign-in history is kept 12 months (GH#419); the account security page only shows recent sessions. */
export const LOGIN_EVENT_RETENTION_MONTHS = 12;
/** QR scan rows are kept 24 months (GH#419), enough for year-on-year statistics. */
export const TRACE_SCAN_RETENTION_MONTHS = 24;

const BATCH_SIZE = 1000;

/** `now` minus whole calendar months, in UTC. */
export function monthsBefore(now: Date, months: number): Date {
  const date = new Date(now.getTime());
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
}

async function purgeOlderThan(
  orm: MikroORM,
  entity: typeof LoginEvent | typeof TraceScan,
  before: Date,
): Promise<number> {
  const em = orm.em.fork();
  let deleted = 0;
  for (;;) {
    const rows = await em.find(
      entity as typeof LoginEvent,
      { createdAt: { $lt: before } },
      { fields: ['id'], limit: BATCH_SIZE },
    );
    if (rows.length === 0) return deleted;
    deleted += await em.nativeDelete(entity as typeof LoginEvent, {
      id: { $in: rows.map((row) => row.id) },
    });
    em.clear();
  }
}

/** Deletes `LoginEvent` rows older than 12 months; returns how many went. Run daily by the worker. */
export function purgeLoginEvents(orm: MikroORM, now = new Date()): Promise<number> {
  return purgeOlderThan(orm, LoginEvent, monthsBefore(now, LOGIN_EVENT_RETENTION_MONTHS));
}

/** Deletes `TraceScan` rows older than 24 months; returns how many went. Run daily by the worker. */
export function purgeTraceScans(orm: MikroORM, now = new Date()): Promise<number> {
  return purgeOlderThan(orm, TraceScan, monthsBefore(now, TRACE_SCAN_RETENTION_MONTHS));
}
