import type { Queue } from 'bullmq';

/**
 * Job retention sized for the 25 MB, `noeviction` Render Key Value (see render.yaml): BullMQ keeps
 * finished jobs forever unless told otherwise, and a full Redis refuses every write (issue #153).
 * BullMQ's `age` is in seconds.
 */
const DAY_SECONDS = 24 * 60 * 60;

export const KEEP_COMPLETED = { count: 100, age: DAY_SECONDS } as const;
export const KEEP_FAILED = { count: 500, age: 7 * DAY_SECONDS } as const;

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: KEEP_COMPLETED,
  removeOnFail: KEEP_FAILED,
} as const;

/**
 * The outbox relay fires every 2 s (~43k jobs a day) and its result is never read, so completed
 * runs are dropped immediately and only a few recent failures are kept for diagnosis.
 * Scheduler jobs inherit these queue defaults when `upsertJobScheduler` creates the next run.
 */
export const OUTBOX_JOB_OPTIONS = {
  removeOnComplete: true,
  removeOnFail: { count: 50, age: DAY_SECONDS },
} as const;

/** Jobs removed per `clean` call, so one Lua call never blocks Redis on a huge backlog. */
export const TRIM_BATCH_SIZE = 1_000;

type TrimmableQueue = Pick<Queue, 'name' | 'clean'>;
interface TrimLogger {
  log(message: string): void;
  warn(message: string): void;
}

async function cleanInBatches(
  queue: TrimmableQueue,
  graceMs: number,
  type: 'completed' | 'failed',
): Promise<number> {
  let removed = 0;
  for (;;) {
    const ids = await queue.clean(graceMs, TRIM_BATCH_SIZE, type);
    removed += ids.length;
    if (ids.length < TRIM_BATCH_SIZE) return removed;
  }
}

/**
 * Drops the finished-job backlog left behind by earlier unbounded retention, so a full Redis
 * recovers on deploy. Run before any write (such as `upsertJobScheduler`) that would fail on OOM.
 * Never throws: a failed cleanup is logged and the worker keeps starting.
 */
export async function trimFinishedJobs(
  queues: readonly TrimmableQueue[],
  logger: TrimLogger,
): Promise<void> {
  for (const queue of queues) {
    try {
      const completed = await cleanInBatches(queue, 0, 'completed');
      const failed = await cleanInBatches(queue, KEEP_FAILED.age * 1_000, 'failed');
      logger.log(`${queue.name}: trimmed ${completed} completed and ${failed} failed jobs`);
    } catch (error) {
      logger.warn(
        `${queue.name}: could not trim finished jobs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
