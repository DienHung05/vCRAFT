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
