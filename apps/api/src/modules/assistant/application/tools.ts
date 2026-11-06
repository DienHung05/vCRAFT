import { lunarDateOf, lunarYearName } from '@vcraft/utils';
import { z } from 'zod';
import type { KeyValueStore } from '../infrastructure/key-value';

/**
 * Read-only tools the assistant may use (PLAN E15): no tool writes data. Arguments are checked with Zod
 * and every call has a 3 s timeout; a failing tool returns `null` and the answer says so politely.
 */
export const TOOL_TIMEOUT_MS = 3_000;

export async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
  try {
    return await work(controller.signal);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** `get_current_datetime`: solar and lunar date and the time in Vietnam. */
export function getCurrentDatetime(now: Date, locale: 'vi' | 'en'): string {
  const solar = new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  const lunar = lunarDateOf(now);
  const leap = lunar.leap ? (locale === 'vi' ? ' (nhuận)' : ' (leap)') : '';
  return locale === 'vi'
    ? `Bây giờ là ${solar} (giờ Việt Nam). Âm lịch: ngày ${lunar.day} tháng ${lunar.month}${leap} năm ${lunarYearName(lunar.year)}.`
    : `It is ${solar} in Vietnam. Lunar calendar: day ${lunar.day} of month ${lunar.month}${leap}, year of ${lunarYearName(lunar.year)}.`;
}

const BAT_TRANG = { name: 'Bát Tràng', latitude: 20.9758, longitude: 105.9139 };
const WEATHER_CACHE_SECONDS = 15 * 60;

export const WeatherArgsSchema = z.object({ place: z.string().trim().max(60).nullable() });

// WMO weather codes grouped into words (https://open-meteo.com/en/docs).
function describe(code: number, locale: 'vi' | 'en'): string {
  const table: [number[], string, string][] = [
    [[0], 'trời quang', 'clear sky'],
    [[1, 2], 'ít mây', 'partly cloudy'],
    [[3], 'nhiều mây', 'overcast'],
    [[45, 48], 'sương mù', 'fog'],
    [[51, 53, 55, 56, 57], 'mưa phùn', 'drizzle'],
    [[61, 63, 65, 66, 67, 80, 81, 82], 'có mưa', 'rain'],
    [[95, 96, 99], 'có dông', 'thunderstorms'],
  ];
  const row = table.find(([codes]) => codes.includes(code));
  return row
    ? locale === 'vi'
      ? row[1]
      : row[2]
    : locale === 'vi'
      ? 'thời tiết thay đổi'
      : 'mixed weather';
}

/**
 * `get_weather`: current weather from Open-Meteo (no key), Bát Tràng by default. Places are geocoded
 * within Vietnam only. Results are cached for 15 minutes per place.
 */
export async function getWeather(
  args: z.infer<typeof WeatherArgsSchema>,
  locale: 'vi' | 'en',
  kv: KeyValueStore,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const { place } = WeatherArgsSchema.parse(args);
  const cacheKey = `assistant:weather:${locale}:${(place ?? 'bat trang').toLowerCase()}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached;
  const answer = await withTimeout(async (signal) => {
    let target = BAT_TRANG;
    if (place) {
      const geo = await fetchImpl(
        `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: place, count: '1', language: 'vi', countryCode: 'VN' })}`,
        { signal },
      );
      const found = ((await geo.json()) as { results?: (typeof BAT_TRANG)[] }).results?.[0];
      if (!found) return null;
      target = found;
    }
    const res = await fetchImpl(
      `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
        latitude: String(target.latitude),
        longitude: String(target.longitude),
        current: 'temperature_2m,weather_code,relative_humidity_2m',
        timezone: 'Asia/Ho_Chi_Minh',
      })}`,
      { signal },
    );
    const body = (await res.json()) as {
      current?: { temperature_2m: number; weather_code: number; relative_humidity_2m: number };
    };
    if (!body.current) return null;
    const { temperature_2m: t, weather_code: code, relative_humidity_2m: humidity } = body.current;
    return locale === 'vi'
      ? `Thời tiết ở ${target.name} bây giờ: ${Math.round(t)}°C, ${describe(code, locale)}, độ ẩm ${humidity}%.`
      : `Weather in ${target.name} now: ${Math.round(t)}°C, ${describe(code, locale)}, humidity ${humidity}%.`;
  });
  if (answer) await kv.set(cacheKey, answer, WEATHER_CACHE_SECONDS);
  return answer;
}

export function weatherFallback(locale: 'vi' | 'en'): string {
  return locale === 'vi'
    ? 'Tớ chưa xem được thời tiết lúc này. Bạn thử lại sau ít phút nhé.'
    : "I can't reach the weather service right now. Try again in a few minutes.";
}

export const SearchCatalogArgsSchema = z.object({ query: z.string().trim().min(1).max(120) });
