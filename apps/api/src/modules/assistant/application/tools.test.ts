import { describe, expect, it, vi } from 'vitest';
import { InMemoryKeyValueStore } from '../infrastructure/key-value';
import { getCurrentDatetime, getWeather, weatherFallback, withTimeout } from './tools';

const json = (body: unknown) => new Response(JSON.stringify(body));

describe('getCurrentDatetime', () => {
  it('gives the Vietnam time with the lunar date and year name', () => {
    // 17 Feb 2026 is lunar New Year's Day of Bính Ngọ.
    const text = getCurrentDatetime(new Date('2026-02-17T03:00:00Z'), 'vi');
    expect(text).toContain('Âm lịch: ngày 1 tháng 1 năm Bính Ngọ');
    expect(getCurrentDatetime(new Date('2026-02-17T03:00:00Z'), 'en')).toContain(
      'day 1 of month 1, year of Bính Ngọ',
    );
  });
});

describe('getWeather', () => {
  const current = { current: { temperature_2m: 27.4, weather_code: 61, relative_humidity_2m: 80 } };

  it('reports Bát Tràng by default and caches the answer', async () => {
    const fetchImpl = vi.fn(async () => json(current));
    const kv = new InMemoryKeyValueStore();
    const first = await getWeather({ place: null }, 'vi', kv, fetchImpl as typeof fetch);
    expect(first).toBe('Thời tiết ở Bát Tràng bây giờ: 27°C, có mưa, độ ẩm 80%.');
    await getWeather({ place: null }, 'vi', kv, fetchImpl as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('geocodes a named place within Vietnam only', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes('geocoding')
        ? json({ results: [{ name: 'Hà Nội', latitude: 21, longitude: 105.8 }] })
        : json(current),
    );
    const text = await getWeather(
      { place: 'ha noi' },
      'en',
      new InMemoryKeyValueStore(),
      fetchImpl as unknown as typeof fetch,
    );
    expect(text).toContain('Weather in Hà Nội now: 27°C, rain');
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain('countryCode=VN');
  });

  it('returns null when the service fails, so the caller can apologise', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });
    expect(
      await getWeather({ place: null }, 'vi', new InMemoryKeyValueStore(), fetchImpl),
    ).toBeNull();
    expect(weatherFallback('vi')).toContain('thời tiết');
  });
});

describe('getWeather providers and fallbacks', () => {
  const current = { current: { temperature_2m: 27.4, weather_code: 61, relative_humidity_2m: 80 } };
  const met = {
    properties: {
      timeseries: [
        {
          data: {
            instant: { details: { air_temperature: 23.9, relative_humidity: 96.9 } },
            next_1_hours: { summary: { symbol_code: 'lightrain_night' } },
          },
        },
      ],
    },
  };
  const rateLimited = () =>
    new Response(JSON.stringify({ error: true, reason: 'Daily API request limit exceeded.' }), {
      status: 429,
      statusText: 'Too Many Requests',
    });
  const call = (
    fn: typeof fetch,
    kv = new InMemoryKeyValueStore(),
    logger = { warn: vi.fn() },
  ) => ({
    kv,
    logger,
    run: () => getWeather({ place: null }, 'vi', kv, fn, logger),
  });

  it('treats a non-2xx Open-Meteo answer as a failure and uses MET Norway', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes('open-meteo') ? rateLimited() : json(met),
    );
    const { run } = call(fetchImpl as unknown as typeof fetch);
    expect(await run()).toBe('Thời tiết ở Bát Tràng bây giờ: 24°C, có mưa, độ ẩm 97%.');
    const metCall = fetchImpl.mock.calls.find(([url]) => url.includes('api.met.no'));
    expect(String(metCall?.[0])).toContain('lat=20.9758&lon=105.9139');
    expect(metCall?.[1]?.headers).toEqual({ 'User-Agent': expect.stringContaining('vCraft/1.0') });
  });

  it('truncates geocoded coordinates to four decimals for MET Norway', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('geocoding'))
        return json({ results: [{ name: 'Huế', latitude: 16.46327, longitude: 107.59081 }] });
      return url.includes('open-meteo') ? rateLimited() : json(met);
    });
    const text = await getWeather(
      { place: 'hue' },
      'vi',
      new InMemoryKeyValueStore(),
      fetchImpl as unknown as typeof fetch,
    );
    expect(text).toContain('Thời tiết ở Huế');
    const metUrl = String(fetchImpl.mock.calls.find(([url]) => url.includes('api.met.no'))?.[0]);
    expect(metUrl).toContain('lat=16.4633&lon=107.5908');
  });

  it('serves the last good answer, marked as old, when both providers fail', async () => {
    const kv = new InMemoryKeyValueStore();
    const ok = call(vi.fn(async () => json(current)) as unknown as typeof fetch, kv);
    expect(await ok.run()).toBe('Thời tiết ở Bát Tràng bây giờ: 27°C, có mưa, độ ẩm 80%.');
    // The 15-minute cache is gone, the 6-hour stale copy is not.
    await kv.set('assistant:weather:vi:bat trang', '', 0);
    const down = call(vi.fn(async () => rateLimited()) as unknown as typeof fetch, kv);
    expect(await down.run()).toBe(
      'Thời tiết ở Bát Tràng bây giờ: 27°C, có mưa, độ ẩm 80%. (số liệu lần cập nhật gần nhất, chưa làm mới được)',
    );
  });

  it('returns null when both providers fail and nothing is stale', async () => {
    const down = call(vi.fn(async () => rateLimited()) as unknown as typeof fetch);
    expect(await down.run()).toBeNull();
  });

  it('logs the provider, HTTP status and reason of each failure', async () => {
    const down = call(vi.fn(async () => rateLimited()) as unknown as typeof fetch);
    await down.run();
    expect(down.logger.warn).toHaveBeenCalledTimes(2);
    expect(down.logger.warn).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'provider=open-meteo place="Bát Tràng" status=429 reason="Daily API request limit exceeded."',
      ),
    );
    expect(down.logger.warn).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('provider=met-norway place="Bát Tràng" status=429'),
    );
  });

  it('logs the error name for a network failure or a timeout', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('This operation was aborted', 'AbortError')),
          ),
        ),
    );
    const down = call(fetchImpl as unknown as typeof fetch);
    const pending = down.run();
    await vi.advanceTimersByTimeAsync(6_000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
    expect(down.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('provider=open-meteo place="Bát Tràng" error=AbortError'),
    );
    expect(down.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('provider=met-norway place="Bát Tràng" error=AbortError'),
    );
  });

  it('does not log anything when Open-Meteo answers', async () => {
    const ok = call(vi.fn(async () => json(current)) as unknown as typeof fetch);
    await ok.run();
    expect(ok.logger.warn).not.toHaveBeenCalled();
  });
});

describe('withTimeout', () => {
  it('gives up after three seconds', async () => {
    vi.useFakeTimers();
    const pending = withTimeout(
      (signal) =>
        new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('x')))),
    );
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
  });
});
