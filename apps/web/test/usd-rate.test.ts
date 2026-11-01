import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_USD_RATE } from '@/lib/currency';
import { getUsdRate, USD_RATE_REVALIDATE_SECONDS, USD_RATE_SOURCES } from '@/lib/usd-rate';

const [PRIMARY, MIRROR] = USD_RATE_SOURCES;

const good = { date: '2026-10-31', usd: { vnd: 25765.52 } };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const spy = vi.fn((input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(handler(String(input))),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getUsdRate', () => {
  it('returns the dated rate from the primary source', async () => {
    const fetchSpy = mockFetch(() => json(good));
    await expect(getUsdRate()).resolves.toEqual({ rate: 25_766, asOf: '2026-10-31' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(PRIMARY);
  });

  it('asks Next to cache the response for 24 hours', async () => {
    const fetchSpy = mockFetch(() => json(good));
    await getUsdRate();
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit & { next?: { revalidate?: number } };
    expect(USD_RATE_REVALIDATE_SECONDS).toBe(86_400);
    expect(init.next).toEqual({ revalidate: 86_400 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to the mirror when the primary source fails', async () => {
    const fetchSpy = mockFetch((url) => (url === PRIMARY ? json({}, 503) : json(good)));
    await expect(getUsdRate()).resolves.toEqual({ rate: 25_766, asOf: '2026-10-31' });
    expect(fetchSpy.mock.calls.map((call) => call[0])).toEqual([PRIMARY, MIRROR]);
  });

  it('falls back to the mirror when the primary request throws', async () => {
    const fetchSpy = vi.fn((input: RequestInfo | URL) =>
      String(input) === PRIMARY
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(json(good)),
    );
    vi.stubGlobal('fetch', fetchSpy);
    await expect(getUsdRate()).resolves.toMatchObject({ asOf: '2026-10-31' });
  });

  it('uses the configured fallback rate when every source is down', async () => {
    mockFetch(() => json({}, 500));
    await expect(getUsdRate()).resolves.toBe(FALLBACK_USD_RATE);
  });

  it('uses the configured fallback rate when the network throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(getUsdRate()).resolves.toBe(FALLBACK_USD_RATE);
  });

  it('ignores a nonsense rate and tries the next source before falling back', async () => {
    const fetchSpy = mockFetch(() => json({ date: '2026-10-31', usd: { vnd: 3 } }));
    await expect(getUsdRate()).resolves.toBe(FALLBACK_USD_RATE);
    expect(fetchSpy).toHaveBeenCalledTimes(USD_RATE_SOURCES.length);
  });

  it('ignores a body that is not JSON', async () => {
    mockFetch(() => new Response('<html>oops</html>', { status: 200 }));
    await expect(getUsdRate()).resolves.toBe(FALLBACK_USD_RATE);
  });
});
