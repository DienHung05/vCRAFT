import type { MikroORM } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import {
  countFailedOutboxEvents,
  dueRequestIds,
  expireDuePayments,
  expireRequest,
  flagRequestsNeedingCoordination,
  purgeAssistantLogs,
  purgeDoneOutboxEvents,
  purgeIdempotencyKeys,
} from '@vcraft/database';

/** Job names on the scheduler queue (PLAN E9). */
export const RFQ_EXPIRE_JOB = 'rfq.expire';
export const RFQ_EXPIRE_SWEEP_JOB = 'rfq.expire-sweep';
export const RFQ_COORDINATION_CHECK_JOB = 'rfq.coordination-check';
/** Deletes assistant logs older than 30 days (PLAN E15). */
export const ASSISTANT_LOG_PURGE_JOB = 'assistant.purge-logs';
/** Deletes idempotency keys older than 24 hours (BR-L5). */
export const IDEMPOTENCY_PURGE_JOB = 'idempotency.purge-keys';
/** Deletes `DONE` outbox events older than 7 days and warns about `FAILED` ones, which are kept. */
export const OUTBOX_PRUNE_JOB = 'outbox.prune';
/** Imports real village news from the configured feeds and, when news is scarce, adds evergreen articles (GH#314). */
export const NEWS_IMPORT_JOB = 'news.import';
/** Expires pending payments past their expiry time and tells the buyers (ADR-0021). */
export const PAYMENT_EXPIRE_SWEEP_JOB = 'payment.expire-sweep';

/** How often the safety sweep and the coordination check run. */
export const RFQ_SWEEP_EVERY_MS = 60_000;
export const COORDINATION_CHECK_EVERY_MS = 15 * 60_000;
export const ASSISTANT_LOG_PURGE_EVERY_MS = 24 * 60 * 60_000;
export const IDEMPOTENCY_PURGE_EVERY_MS = 60 * 60_000;
export const OUTBOX_PRUNE_EVERY_MS = 24 * 60 * 60_000;
export const PAYMENT_EXPIRE_EVERY_MS = 60_000;

const logger = new Logger('OutboxPrune');

/** Prunes old `DONE` outbox events; `FAILED` events are never deleted, only counted in a warning. */
export async function pruneOutbox(
  orm: MikroORM,
  now = new Date(),
): Promise<{ deleted: number; failed: number }> {
  const deleted = await purgeDoneOutboxEvents(orm, now);
  const failed = await countFailedOutboxEvents(orm);
  if (failed > 0) logger.warn(`${failed} outbox event(s) are FAILED and need attention`);
  return { deleted, failed };
}

export interface RfqExpireJob {
  requestId: string;
}

/** Runs one scheduler job; every handler is idempotent, so BullMQ retries are safe. */
export async function runSchedulerJob(
  orm: MikroORM,
  name: string,
  data: unknown,
  now = new Date(),
): Promise<unknown> {
  switch (name) {
    case RFQ_EXPIRE_JOB:
      return expireRequest(orm, (data as RfqExpireJob).requestId, now);
    case RFQ_EXPIRE_SWEEP_JOB: {
      const outcomes = [];
      for (const id of await dueRequestIds(orm, now))
        outcomes.push(await expireRequest(orm, id, now));
      return outcomes;
    }
    case RFQ_COORDINATION_CHECK_JOB:
      return flagRequestsNeedingCoordination(orm, now);
    case ASSISTANT_LOG_PURGE_JOB:
      return purgeAssistantLogs(orm, now);
    case IDEMPOTENCY_PURGE_JOB:
      return purgeIdempotencyKeys(orm, now);
    case OUTBOX_PRUNE_JOB:
      return pruneOutbox(orm, now);
    case PAYMENT_EXPIRE_SWEEP_JOB:
      return expireDuePayments(orm, now);
    default:
      throw new Error(`unknown scheduler job: ${name}`);
  }
}
