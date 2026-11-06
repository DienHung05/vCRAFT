import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_JOB_OPTIONS,
  KEEP_COMPLETED,
  KEEP_FAILED,
  OUTBOX_JOB_OPTIONS,
  TRIM_BATCH_SIZE,
  trimFinishedJobs,
} from '../src/queue-retention';

const ids = (n: number) => Array.from({ length: n }, (_, i) => String(i));
const logger = () => ({ log: vi.fn(), warn: vi.fn() });

describe('job retention options', () => {
  it('bounds default completed and failed jobs by count and age', () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual(KEEP_COMPLETED);
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual(KEEP_FAILED);
    expect(KEEP_COMPLETED.count).toBeLessThanOrEqual(100);
    expect(KEEP_COMPLETED.age).toBeLessThanOrEqual(24 * 60 * 60);
    expect(KEEP_FAILED.count).toBeLessThanOrEqual(500);
    expect(KEEP_FAILED.age).toBeLessThanOrEqual(7 * 24 * 60 * 60);
  });

  it('drops completed outbox relay jobs and keeps only a few recent failures', () => {
    expect(OUTBOX_JOB_OPTIONS.removeOnComplete).toBe(true);
    expect(OUTBOX_JOB_OPTIONS.removeOnFail.count).toBeLessThanOrEqual(50);
    expect(OUTBOX_JOB_OPTIONS.removeOnFail.age).toBeLessThanOrEqual(24 * 60 * 60);
  });
});

describe('trimFinishedJobs', () => {
  it('cleans in batches until a batch comes back short', async () => {
    const clean = vi
      .fn()
      .mockResolvedValueOnce(ids(TRIM_BATCH_SIZE))
      .mockResolvedValueOnce(ids(TRIM_BATCH_SIZE))
      .mockResolvedValueOnce(ids(7)) // completed done
      .mockResolvedValueOnce(ids(3)); // failed done
    const log = logger();

    await trimFinishedJobs([{ name: 'outbox', clean }], log);

    expect(clean.mock.calls).toEqual([
      [0, TRIM_BATCH_SIZE, 'completed'],
      [0, TRIM_BATCH_SIZE, 'completed'],
      [0, TRIM_BATCH_SIZE, 'completed'],
      [KEEP_FAILED.age * 1_000, TRIM_BATCH_SIZE, 'failed'],
    ]);
    expect(log.log).toHaveBeenCalledWith(
      `outbox: trimmed ${2 * TRIM_BATCH_SIZE + 7} completed and 3 failed jobs`,
    );
  });

  it('trims every queue it is given', async () => {
    const queues = ['a', 'b'].map((name) => ({ name, clean: vi.fn().mockResolvedValue([]) }));

    await trimFinishedJobs(queues, logger());

    for (const queue of queues) expect(queue.clean).toHaveBeenCalledTimes(2);
  });

  it('logs and swallows a cleanup error, then carries on with the next queue', async () => {
    const broken = {
      name: 'outbox',
      clean: vi.fn().mockRejectedValue(new Error('OOM command not allowed')),
    };
    const healthy = { name: 'mail', clean: vi.fn().mockResolvedValue([]) };
    const log = logger();

    await expect(trimFinishedJobs([broken, healthy], log)).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      'outbox: could not trim finished jobs: OOM command not allowed',
    );
    expect(healthy.clean).toHaveBeenCalledTimes(2);
  });
});
