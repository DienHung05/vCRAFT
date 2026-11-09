import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  purgeDoneOutboxEvents: vi.fn(),
  countFailedOutboxEvents: vi.fn(),
}));
vi.mock('@vcraft/database', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...database,
}));

import {
  OUTBOX_PRUNE_JOB,
  pruneOutbox,
  runSchedulerJob,
} from '../src/processors/scheduler/rfq-jobs';

const orm = {} as never;

afterEach(() => vi.restoreAllMocks());

describe('outbox pruning job', () => {
  it('deletes finished events and warns with the number of FAILED ones', async () => {
    database.purgeDoneOutboxEvents.mockResolvedValue(12);
    database.countFailedOutboxEvents.mockResolvedValue(3);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const now = new Date('2026-11-09T00:00:00Z');

    expect(await runSchedulerJob(orm, OUTBOX_PRUNE_JOB, {}, now)).toEqual({
      deleted: 12,
      failed: 3,
    });
    expect(database.purgeDoneOutboxEvents).toHaveBeenCalledWith(orm, now);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('3 outbox event(s)'));
  });

  it('stays quiet when nothing failed', async () => {
    database.purgeDoneOutboxEvents.mockResolvedValue(0);
    database.countFailedOutboxEvents.mockResolvedValue(0);
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await pruneOutbox(orm);
    expect(warn).not.toHaveBeenCalled();
  });
});
