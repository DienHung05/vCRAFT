import type { MikroORM } from '@mikro-orm/core';
import { IdempotencyKey } from '../entities/idempotency-key.entity.js';

/** An `Idempotency-Key` is honoured for 24 hours (BR-L5); older rows are ignored by lookups and purged. */
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60_000;

/** Deletes idempotency rows older than 24 hours; returns how many went. Run hourly by the worker. */
export async function purgeIdempotencyKeys(orm: MikroORM, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - IDEMPOTENCY_KEY_TTL_MS);
  return orm.em.fork().nativeDelete(IdempotencyKey, { createdAt: { $lt: before } });
}
