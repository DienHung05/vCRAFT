import type { MikroORM } from '@mikro-orm/core';
import { Logger } from '@nestjs/common';
import {
  countFailedOutboxEvents,
  deleteMediaAssetRows,
  dueRequestIds,
  expireDuePayments,
  expireRequest,
  findOrphanMediaAssets,
  flagRequestsNeedingCoordination,
  MEDIA_ORPHAN_BATCH_SIZE,
  purgeAssistantLogs,
  purgeDoneOutboxEvents,
  purgeIdempotencyKeys,
} from '@vcraft/database';
import type { ObjectStorage } from '@vcraft/storage';

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
/** Deletes media assets nothing refers to any more, with their stored files (GH#381). */
export const MEDIA_ORPHAN_SWEEP_JOB = 'media.orphan-sweep';
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
export const MEDIA_ORPHAN_SWEEP_EVERY_MS = 24 * 60 * 60_000;
/** Upper bound of batches per run, so one run cannot loop forever. */
const MEDIA_ORPHAN_MAX_BATCHES = 50;

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

const mediaLogger = new Logger('MediaOrphanSweep');

/**
 * Removes orphan media assets in batches: the private original and every public variant first, the row only
 * after all its files are gone. An asset whose files cannot be removed keeps its row and is retried next run.
 *
 * Deleting files cannot be undone, so the sweep only reports what it would remove unless
 * `MEDIA_ORPHAN_SWEEP=delete` is set; turn it on after the logged candidates look right.
 */
export async function sweepOrphanMedia(
  orm: MikroORM,
  storage: ObjectStorage,
  now = new Date(),
  mode: string | undefined = process.env.MEDIA_ORPHAN_SWEEP,
): Promise<{ deleted: number; failed: number }> {
  if (mode !== 'delete') {
    const candidates = await findOrphanMediaAssets(orm, { now, limit: MEDIA_ORPHAN_BATCH_SIZE });
    if (candidates.length > 0)
      mediaLogger.log(
        `report only (MEDIA_ORPHAN_SWEEP is not "delete"): ${candidates.length}+ orphan media asset(s), e.g. ${candidates
          .slice(0, 5)
          .map((asset) => asset.id)
          .join(', ')}`,
      );
    return { deleted: 0, failed: 0 };
  }
  let deleted = 0;
  const failed = new Set<string>();
  for (let batch = 0; batch < MEDIA_ORPHAN_MAX_BATCHES; batch += 1) {
    const orphans = await findOrphanMediaAssets(orm, {
      now,
      limit: MEDIA_ORPHAN_BATCH_SIZE,
      excludeIds: failed,
    });
    if (orphans.length === 0) break;
    const removable: string[] = [];
    for (const asset of orphans) {
      try {
        await storage.delete('private', asset.originalKey);
        for (const variant of asset.variants) await storage.delete('public', variant.key);
        removable.push(asset.id);
      } catch (error) {
        failed.add(asset.id);
        mediaLogger.warn(`could not remove files of media asset ${asset.id}: ${String(error)}`);
      }
    }
    deleted += await deleteMediaAssetRows(orm, removable);
  }
  if (deleted > 0 || failed.size > 0)
    mediaLogger.log(`removed ${deleted} orphan media asset(s); ${failed.size} left for retry`);
  return { deleted, failed: failed.size };
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
  storage?: ObjectStorage,
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
    case MEDIA_ORPHAN_SWEEP_JOB:
      if (!storage) throw new Error('media orphan sweep needs object storage');
      return sweepOrphanMedia(orm, storage, now);
    default:
      throw new Error(`unknown scheduler job: ${name}`);
  }
}
