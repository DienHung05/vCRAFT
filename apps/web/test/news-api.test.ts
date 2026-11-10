// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchNews, fetchNewsArticle } from '@/features/news/news-api';

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
      sourceName: null,
      sourceUrl: null,
      sourcePublishedAt: null,
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
  it('keeps the source of a story and rejects a page without the source fields', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test/api/v1');
    const withSource = {
      ...ok,
      data: [
        {
          ...ok.data[0],
          sourceName: 'Hà Nội Mới',
          sourceUrl: 'https://hanoimoi.vn/bai-viet',
          sourcePublishedAt: '2026-08-29T00:00:00.000Z',
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(withSource))));
    const result = await fetchNews();
    expect(result.status === 'ok' && result.page.data[0]?.sourceName).toBe('Hà Nội Mới');
    const {
      sourceName: _a,
      sourceUrl: _b,
      sourcePublishedAt: _c,
      ...legacy
    } = ok.data[0] as Record<string, unknown>;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...ok, data: [legacy] }))),
    );
    expect((await fetchNews()).status).toBe('unavailable');
  });

  it('calls the configured API with filter and cursor and parses the page', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test/api/v1/');
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(ok)));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchNews({
      category: 'MATERIAL_PRICES',
      householdSlug: 'gom-a',
      cursor: 'xyz',
    });
    expect(result).toEqual({ status: 'ok', page: ok });
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url.startsWith('http://api.test/api/v1/news?')).toBe(true);
    expect(url).toContain('category=MATERIAL_PRICES');
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

describe('news stays up to date without a redeploy (GH#181)', () => {
  it('list is cached for at most 30 seconds and the article is not cached (GH#395)', async () => {
    vi.stubEnv('API_INTERNAL_URL', 'http://api.test/api/v1/');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    await fetchNews();
    await fetchNewsArticle('a');
    for (const [, init] of fetchMock.mock.calls) {
      const { cache, next } = init as { cache?: string; next?: { revalidate?: number } };
      if (cache === 'no-store') continue;
      expect(next?.revalidate).toBeGreaterThan(0);
      expect(next?.revalidate).toBeLessThanOrEqual(30);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
