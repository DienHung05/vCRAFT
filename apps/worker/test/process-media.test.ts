import type { MikroORM } from '@mikro-orm/core';
import type { ObjectStorage } from '@vcraft/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const encodeAvif = vi.fn();
const convertImageInPhases = vi.fn();
const convertMissingVariants = vi.fn();
vi.mock('../src/processors/media/convert-image', () => ({
  convertImageInPhases: (...args: unknown[]) => convertImageInPhases(...args),
  convertMissingVariants: (...args: unknown[]) => convertMissingVariants(...args),
}));

const { failMediaAsset, processMediaAsset } = await import('../src/processors/media/process-media');

interface FakeAsset {
  id: string;
  status: string;
  visibility: string;
  mimeType: string;
  originalKey: string;
  variants: { format: string; width: number; height: number; key: string; bytes: number }[];
  failureReason?: string;
}

function setup(asset: FakeAsset | null) {
  const flush = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn();
  const orm = {
    em: { fork: () => ({ findOne: async () => asset, flush, create }) },
  } as unknown as MikroORM;
  const put = vi.fn().mockResolvedValue(undefined);
  const storage = {
    get: vi.fn().mockResolvedValue(new Uint8Array([1])),
    put,
  } as unknown as ObjectStorage;
  return { orm, storage, put, flush, create };
}

const asset = (over: Partial<FakeAsset> = {}): FakeAsset => ({
  id: 'a1',
  status: 'PROCESSING',
  visibility: 'PUBLIC',
  mimeType: 'image/png',
  originalKey: 'originals/a1',
  variants: [],
  ...over,
});

const variant = (format: 'webp' | 'avif', width: number) => ({
  format,
  width,
  height: width,
  hash: 'h',
  bytes: new Uint8Array(3),
});

beforeEach(() => {
  encodeAvif.mockReset().mockResolvedValue([variant('avif', 640)]);
  convertImageInPhases.mockReset().mockResolvedValue({
    width: 640,
    height: 640,
    thumbhash: 't',
    dominantColor: '#000000',
    webp: [variant('webp', 640)],
    encodeAvif,
  });
  // The additive backfill path (GH#530) encodes only the sizes a READY asset lacks.
  convertMissingVariants.mockReset().mockResolvedValue([variant('avif', 640)]);
});

describe('failMediaAsset (GH#345)', () => {
  it('marks a PROCESSING asset FAILED with the error as reason', async () => {
    const a = asset();
    const { orm, flush } = setup(a);
    await failMediaAsset({ orm }, 'a1', new Error('storage down'));
    expect(a).toMatchObject({ status: 'FAILED', failureReason: 'storage down' });
    expect(flush).toHaveBeenCalled();
  });

  it('leaves a READY asset (WebP already live) untouched', async () => {
    const a = asset({ status: 'READY' });
    const { orm, flush } = setup(a);
    await failMediaAsset({ orm }, 'a1', new Error('x'));
    expect(a.status).toBe('READY');
    expect(flush).not.toHaveBeenCalled();
  });
});

describe('processMediaAsset resumability (GH#345)', () => {
  it('stores WebP, turns READY, then adds AVIF', async () => {
    const a = asset();
    const { orm, storage } = setup(a);
    await processMediaAsset({ orm, storage }, 'a1');
    expect(a.status).toBe('READY');
    expect(a.variants.map((v) => v.format)).toEqual(['avif', 'webp']);
  });

  it('queues one exhibition.changed event when the asset turns READY, not on the AVIF-only retry (ADR-0027)', async () => {
    const first = setup(asset());
    await processMediaAsset({ orm: first.orm, storage: first.storage }, 'a1');
    expect(first.create).toHaveBeenCalledTimes(1);
    expect(first.create.mock.calls[0]?.[1]).toEqual({
      type: 'exhibition.changed',
      payload: { tags: ['exhibition'] },
    });

    const webp = { format: 'webp', width: 640, height: 640, key: 'v/a1/640-h.webp', bytes: 3 };
    const retry = setup(asset({ status: 'READY', variants: [webp] }));
    await processMediaAsset({ orm: retry.orm, storage: retry.storage }, 'a1');
    expect(retry.create).not.toHaveBeenCalled();
  });

  it('on retry after an AVIF failure, a READY asset gets its AVIF variants without rewriting WebP', async () => {
    const webp = { format: 'webp', width: 640, height: 640, key: 'v/a1/640-h.webp', bytes: 3 };
    const a = asset({ status: 'READY', variants: [webp] });
    const { orm, storage, put } = setup(a);
    await processMediaAsset({ orm, storage }, 'a1');
    expect(a.status).toBe('READY');
    expect(a.variants.map((v) => v.format)).toEqual(['avif', 'webp']);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0]?.[0].key).toMatch(/\.avif$/);
  });

  it('does nothing for a READY asset that already has AVIF', async () => {
    const a = asset({
      status: 'READY',
      variants: [{ format: 'avif', width: 640, height: 640, key: 'k', bytes: 1 }],
    });
    const { orm, storage, put } = setup(a);
    await processMediaAsset({ orm, storage }, 'a1');
    expect(put).not.toHaveBeenCalled();
    expect(convertImageInPhases).not.toHaveBeenCalled();
  });

  it('keeps a READY asset READY when the retry cannot decode', async () => {
    const a = asset({
      status: 'READY',
      variants: [{ format: 'webp', width: 640, height: 640, key: 'k', bytes: 1 }],
    });
    convertMissingVariants.mockRejectedValue(new Error('bad'));
    const { orm, storage } = setup(a);
    await processMediaAsset({ orm, storage }, 'a1');
    expect(a.status).toBe('READY');
  });
});
