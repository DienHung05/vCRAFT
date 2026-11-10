import { describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  purgeLoginEvents: vi.fn(),
  purgeTraceScans: vi.fn(),
}));
vi.mock('@vcraft/database', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...database,
}));

import {
  LOGIN_EVENT_PURGE_JOB,
  runSchedulerJob,
  TRACE_SCAN_PURGE_JOB,
} from '../src/processors/scheduler/rfq-jobs';

const orm = {} as never;

describe('data retention jobs', () => {
  it('purges old sign-in history', async () => {
    database.purgeLoginEvents.mockResolvedValue(5);
    const now = new Date('2026-11-09T00:00:00Z');
    expect(await runSchedulerJob(orm, LOGIN_EVENT_PURGE_JOB, {}, now)).toBe(5);
    expect(database.purgeLoginEvents).toHaveBeenCalledWith(orm, now);
  });

  it('purges old QR scans', async () => {
    database.purgeTraceScans.mockResolvedValue(7);
    const now = new Date('2026-11-09T00:00:00Z');
    expect(await runSchedulerJob(orm, TRACE_SCAN_PURGE_JOB, {}, now)).toBe(7);
    expect(database.purgeTraceScans).toHaveBeenCalledWith(orm, now);
  });
});
