// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNews } from '@/features/news/news-api';

const ok = {
  data: [
    {
      slug: 'a',
      title: 'A',
      summary: 'S',
      category: 'CRAFT_STORY',
      pinned: false,
      publishedAt: '2026-08-30T03:00:00.000Z',
      householdName: null,
      householdSlug: null,
      cover: null,
    },
  ],
  nextCursor: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('fetchNews', () => {
  it('calls the configured API with filter and cursor and parses the page', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test/api/v1/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ok)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchNews({ householdSlug: 'gom-a', cursor: 'xyz' });
    expect(result).toEqual({ status: 'ok', page: ok });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url.startsWith('http://api.test/api/v1/news?')).toBe(true);
    expect(url).toContain('householdSlug=gom-a');
    expect(url).toContain('cursor=xyz');
  });

  it('degrades to unavailable on network error, HTTP error and malformed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await fetchNews()).toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })));
    expect(await fetchNews()).toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ x: 1 }))));
    expect(await fetchNews()).toEqual({ status: 'unavailable' });
  });
});
