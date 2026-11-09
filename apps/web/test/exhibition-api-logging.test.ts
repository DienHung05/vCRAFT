import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProductPage } from '@/features/catalog/exhibition-api';
import { fetchNews } from '@/features/news/news-api';
import { logApiFailure } from '@/lib/api/log-api-failure';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('logApiFailure', () => {
  it('logs the resource and HTTP status without the query string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logApiFailure('/products?q=secret&page=1', { kind: 'http', status: 422 });
    expect(warn).toHaveBeenCalledWith('[api] /products unavailable: HTTP 422');
  });

  it('logs only the resource for paths that carry a slug', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logApiFailure('/households/some-slug', { kind: 'http', status: 500 });
    expect(warn).toHaveBeenCalledWith('[api] /households unavailable: HTTP 500');
  });

  it('logs the first three Zod issue paths for a schema mismatch', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logApiFailure('/products', {
      kind: 'schema',
      issues: [
        { path: ['data', 0, 'priceVnd'] },
        { path: ['total'] },
        { path: [] },
        { path: ['extra'] },
      ],
    });
    expect(warn).toHaveBeenCalledWith(
      '[api] /products unavailable: schema mismatch at data.0.priceVnd, total, (root)',
    );
  });

  it('names a timeout and other errors', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logApiFailure('/news', { kind: 'error', error: new DOMException('t', 'TimeoutError') });
    logApiFailure('/news', { kind: 'error', error: new TypeError('fetch failed') });
    expect(warn).toHaveBeenNthCalledWith(1, '[api] /news unavailable: timeout');
    expect(warn).toHaveBeenNthCalledWith(2, '[api] /news unavailable: error TypeError');
  });
});

describe('server API helpers report why they are unavailable', () => {
  it('fetchProductPage logs the status of a rejected request', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 422 })));
    await expect(fetchProductPage({ page: 1, limit: 12 })).resolves.toEqual({
      status: 'unavailable',
    });
    expect(warn).toHaveBeenCalledWith('[api] /products unavailable: HTTP 422');
  });

  it('fetchNews logs a schema mismatch', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A fresh Response per call: the schema failure triggers a second, uncached read.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => Response.json({ nope: true })),
    );
    await expect(fetchNews()).resolves.toEqual({ status: 'unavailable' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/^\[api\] \/news unavailable: schema mismatch at /);
  });
});
