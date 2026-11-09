import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  findOrphanMediaAssets: vi.fn(),
  deleteMediaAssetRows: vi.fn(),
}));
vi.mock('@vcraft/database', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...database,
}));

import {
  MEDIA_ORPHAN_SWEEP_JOB,
  runSchedulerJob,
  sweepOrphanMedia,
} from '../src/processors/scheduler/rfq-jobs';

const orm = {} as never;
const asset = (id: string, variantKeys: string[] = []) => ({
  id,
  originalKey: `originals/u/${id}`,
  variants: variantKeys.map((key) => ({ key })),
});
const storageMock = () =>
  ({ delete: vi.fn().mockResolvedValue(undefined) }) as never as {
    delete: ReturnType<typeof vi.fn>;
  };

afterEach(() => {
  vi.restoreAllMocks();
  database.findOrphanMediaAssets.mockReset();
  database.deleteMediaAssetRows.mockReset();
});

describe('orphan media sweep (GH#381)', () => {
  it('deletes the original and every variant, then the rows', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    database.findOrphanMediaAssets
      .mockResolvedValueOnce([asset('a', ['v/a/1.webp', 'v/a/1.avif']), asset('b')])
      .mockResolvedValueOnce([]);
    database.deleteMediaAssetRows.mockResolvedValue(2);
    const storage = storageMock();

    const result = await sweepOrphanMedia(orm, storage as never);

    expect(result).toEqual({ deleted: 2, failed: 0 });
    expect(storage.delete.mock.calls).toEqual([
      ['private', 'originals/u/a'],
      ['public', 'v/a/1.webp'],
      ['public', 'v/a/1.avif'],
      ['private', 'originals/u/b'],
    ]);
    expect(database.deleteMediaAssetRows).toHaveBeenCalledWith(orm, ['a', 'b']);
  });

  it('keeps the row of an asset whose files could not be removed and does not retry it in the run', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    database.findOrphanMediaAssets
      .mockResolvedValueOnce([asset('bad'), asset('good')])
      .mockResolvedValueOnce([]);
    database.deleteMediaAssetRows.mockResolvedValue(1);
    const storage = storageMock();
    storage.delete.mockImplementation(async (_bucket: string, key: string) => {
      if (key.endsWith('/bad')) throw new Error('storage down');
    });

    const result = await sweepOrphanMedia(orm, storage as never);

    expect(result).toEqual({ deleted: 1, failed: 1 });
    expect(database.deleteMediaAssetRows).toHaveBeenCalledWith(orm, ['good']);
    expect(database.findOrphanMediaAssets.mock.calls[1]?.[1].excludeIds).toEqual(new Set(['bad']));
  });

  it('is dispatched by the scheduler and needs storage', async () => {
    database.findOrphanMediaAssets.mockResolvedValue([]);
    const now = new Date('2026-11-09T00:00:00Z');
    expect(
      await runSchedulerJob(orm, MEDIA_ORPHAN_SWEEP_JOB, {}, now, storageMock() as never),
    ).toEqual({
      deleted: 0,
      failed: 0,
    });
    expect(database.findOrphanMediaAssets.mock.calls[0]?.[1].now).toBe(now);
    await expect(runSchedulerJob(orm, MEDIA_ORPHAN_SWEEP_JOB, {}, now)).rejects.toThrow(
      /object storage/,
    );
  });
});
