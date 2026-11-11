import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { fetchPublicJson } from '@/lib/api/fetch-public-json';

const Schema = z.object({ title: z.string(), sourceName: z.string() });
const valid = { title: 'A', sourceName: 'S' };
const stale = { title: 'A' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('fetchPublicJson', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a valid cached answer without refetching', async () => {
    fetchMock.mockResolvedValueOnce(json(valid));
    const result = await fetchPublicJson('/news/a', Schema, { revalidate: 30 });
    expect(result).toEqual({ status: 'ok', data: valid });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 30 } });
  });

  it('passes tags next to revalidate, and refetches an invalid cached answer untagged with no-store', async () => {
    fetchMock.mockResolvedValueOnce(json(stale)).mockResolvedValueOnce(json(valid));
    const result = await fetchPublicJson('/products/a', Schema, {
      revalidate: 60,
      tags: ['exhibition', 'product:a'],
    });
    expect(result).toEqual({ status: 'ok', data: valid });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      next: { revalidate: 60, tags: ['exhibition', 'product:a'] },
    });
    const refetch = fetchMock.mock.calls[1]?.[1] as RequestInit & { next?: unknown };
    expect(refetch.cache).toBe('no-store');
    expect(refetch.next).toBeUndefined();
  });

  it('sends no tags key when none are given, and ignores tags on an uncached read', async () => {
    fetchMock.mockResolvedValueOnce(json(valid)).mockResolvedValueOnce(json(valid));
    await fetchPublicJson('/news/a', Schema, { revalidate: 30 });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 30 } });
    expect(fetchMock.mock.calls[0]?.[1].next).not.toHaveProperty('tags');
    await fetchPublicJson('/news/a', Schema, { tags: ['exhibition'] });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty('next');
  });

  it('refetches with no-store when the cached answer fails the schema and uses a valid result', async () => {
    fetchMock.mockResolvedValueOnce(json(stale)).mockResolvedValueOnce(json(valid));
    const result = await fetchPublicJson('/news/a', Schema, { revalidate: 30 });
    expect(result).toEqual({ status: 'ok', data: valid });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('returns not-found when the no-store refetch answers 404', async () => {
    fetchMock.mockResolvedValueOnce(json(stale)).mockResolvedValueOnce(json({}, 404));
    expect(await fetchPublicJson('/news/a', Schema, { revalidate: 30 })).toEqual({
      status: 'not-found',
    });
  });

  it('returns unavailable when the refetch is still invalid, and logs the mismatch', async () => {
    fetchMock.mockResolvedValueOnce(json(stale)).mockResolvedValueOnce(json(stale));
    expect(await fetchPublicJson('/news/a', Schema, { revalidate: 30 })).toEqual({
      status: 'unavailable',
    });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('schema mismatch'));
  });

  it('reads uncached by default and does not refetch an invalid answer', async () => {
    fetchMock.mockResolvedValueOnce(json(stale));
    expect(await fetchPublicJson('/news/a', Schema)).toEqual({ status: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });

  it('maps a network error and a 5xx to unavailable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(json({}, 500));
    expect(await fetchPublicJson('/x', Schema)).toEqual({ status: 'unavailable' });
    expect(await fetchPublicJson('/x', Schema)).toEqual({ status: 'unavailable' });
  });
});
