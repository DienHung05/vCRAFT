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
const WEATHER_STALE_SECONDS = 6 * 60 * 60;

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

/** The minimal logger the weather lookup needs; Nest's `Logger` satisfies it. */
export interface WeatherLogger {
  warn(message: string): void;
}

const NO_LOGGER: WeatherLogger = { warn: () => undefined };

/** A provider answered, but not with a usable forecast. `status` is the HTTP status of its response. */
class WeatherProviderError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(reason);
  }
}

interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/** A current reading in provider-neutral form; `code` is a WMO weather code (-1 when unknown). */
interface WeatherReading {
  temperature: number;
  humidity: number;
  code: number;
}

/** Open-Meteo errors look like `{"error":true,"reason":"..."}`; other bodies (e.g. HTML) fall back to the status text. */
async function failureReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { reason?: unknown };
    if (typeof body.reason === 'string' && body.reason) return body.reason.slice(0, 200);
  } catch {
    // Not JSON: use the status text below.
  }
  return res.statusText || 'no reason given';
}

async function fetchOpenMeteo(
  target: Place,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<WeatherReading> {
  const res = await fetchImpl(
    `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
      latitude: String(target.latitude),
      longitude: String(target.longitude),
      current: 'temperature_2m,weather_code,relative_humidity_2m',
      timezone: 'Asia/Ho_Chi_Minh',
    })}`,
    { signal },
  );
  if (!res.ok) throw new WeatherProviderError(res.status, await failureReason(res));
  const body = (await res.json()) as {
    current?: { temperature_2m: number; weather_code: number; relative_humidity_2m: number };
  };
  if (!body.current) throw new WeatherProviderError(res.status, 'response has no current block');
  return {
    temperature: body.current.temperature_2m,
    humidity: body.current.relative_humidity_2m,
    code: body.current.weather_code,
  };
}

// MET Norway symbol codes (https://github.com/metno/weathericons) mapped to the WMO codes `describe` knows.
// Day/night variants (`_day`, `_night`, `_polartwilight`) are stripped before matching.
function metSymbolToWmo(symbolCode: string | undefined): number {
  const symbol = (symbolCode ?? '').replace(/_(day|night|polartwilight)$/, '');
  if (symbol.includes('thunder')) return 95;
  if (symbol === 'clearsky') return 0;
  if (symbol === 'fair' || symbol === 'partlycloudy') return 1;
  if (symbol === 'cloudy') return 3;
  if (symbol === 'fog') return 45;
  if (symbol.includes('rain') || symbol.includes('sleet')) return 61;
  return -1;
}

/** MET Norway's terms require an identifying User-Agent, and coordinates with at most 4 decimals. */
const MET_USER_AGENT = 'vCraft/1.0 https://vcraft.click';

interface MetSummary {
  summary?: { symbol_code?: string };
}

async function fetchMetNorway(
  target: Place,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<WeatherReading> {
  const res = await fetchImpl(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?${new URLSearchParams({
      lat: target.latitude.toFixed(4),
      lon: target.longitude.toFixed(4),
    })}`,
    { signal, headers: { 'User-Agent': MET_USER_AGENT } },
  );
  if (!res.ok) throw new WeatherProviderError(res.status, await failureReason(res));
  const body = (await res.json()) as {
    properties?: {
      timeseries?: {
        data?: {
          instant?: { details?: { air_temperature?: number; relative_humidity?: number } };
          next_1_hours?: MetSummary;
          next_6_hours?: MetSummary;
        };
      }[];
    };
  };
  const data = body.properties?.timeseries?.[0]?.data;
  const details = data?.instant?.details;
  if (
    typeof details?.air_temperature !== 'number' ||
    typeof details.relative_humidity !== 'number'
  ) {
    throw new WeatherProviderError(
      res.status,
      'response has no air_temperature or relative_humidity',
    );
  }
  return {
    temperature: details.air_temperature,
    humidity: details.relative_humidity,
    code: metSymbolToWmo((data?.next_1_hours ?? data?.next_6_hours)?.summary?.symbol_code),
  };
}

/** One log line: provider, HTTP status and the provider's reason, or the error name and message. */
function describeFailure(provider: string, place: string, error: unknown): string {
  const head = `weather lookup failed: provider=${provider} place=${JSON.stringify(place)}`;
  if (error instanceof WeatherProviderError) {
    return `${head} status=${error.status} reason=${JSON.stringify(error.reason)}`;
  }
  if (error instanceof Error) {
    // `fetch failed` hides the real cause (DNS, connection reset...) in `cause`.
    const cause = (error as { cause?: { code?: unknown; message?: unknown } }).cause;
    const detail = cause?.code ?? cause?.message;
    const causeText = detail ? ` cause=${JSON.stringify(String(detail))}` : '';
    return `${head} error=${error.name} message=${JSON.stringify(error.message)}${causeText}`;
  }
  return `${head} error=${JSON.stringify(String(error))}`;
}

/** Runs one provider call with its own timeout; a failure is logged once and turns into `null`. */
async function attempt<T>(
  provider: string,
  place: string,
  logger: WeatherLogger,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);
  try {
    return await work(controller.signal);
  } catch (error) {
    logger.warn(describeFailure(provider, place, error));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function weatherSentence(target: Place, reading: WeatherReading, locale: 'vi' | 'en'): string {
  const { temperature, humidity, code } = reading;
  return locale === 'vi'
    ? `Thời tiết ở ${target.name} bây giờ: ${Math.round(temperature)}°C, ${describe(code, locale)}, độ ẩm ${Math.round(humidity)}%.`
    : `Weather in ${target.name} now: ${Math.round(temperature)}°C, ${describe(code, locale)}, humidity ${Math.round(humidity)}%.`;
}

/**
 * `get_weather`: current weather, Bát Tràng by default. Places are geocoded within Vietnam only (Open-Meteo).
 * The forecast comes from Open-Meteo, then from MET Norway if that fails (both need no key; shared cloud
 * egress IPs are sometimes rate-limited). Each provider call has its own 3 s timeout and every failure is
 * logged. A fresh answer is cached for 15 minutes per place; the last good answer is kept for 6 hours and
 * served, marked as old, when every provider fails.
 */
export async function getWeather(
  args: z.infer<typeof WeatherArgsSchema>,
  locale: 'vi' | 'en',
  kv: KeyValueStore,
  fetchImpl: typeof fetch = fetch,
  logger: WeatherLogger = NO_LOGGER,
): Promise<string | null> {
  const { place } = WeatherArgsSchema.parse(args);
  const placeKey = `${locale}:${(place ?? 'bat trang').toLowerCase()}`;
  const cacheKey = `assistant:weather:${placeKey}`;
  const staleKey = `assistant:weather-stale:${placeKey}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached;
  const label = place ?? BAT_TRANG.name;

  const staleAnswer = async () => {
    const stale = await kv.get(staleKey);
    if (!stale) return null;
    return locale === 'vi'
      ? `${stale} (số liệu lần cập nhật gần nhất, chưa làm mới được)`
      : `${stale} (last known reading, could not refresh)`;
  };

  let target: Place = BAT_TRANG;
  if (place) {
    const found = await attempt('open-meteo-geocoding', label, logger, async (signal) => {
      const geo = await fetchImpl(
        `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: place, count: '1', language: 'vi', countryCode: 'VN' })}`,
        { signal },
      );
      if (!geo.ok) throw new WeatherProviderError(geo.status, await failureReason(geo));
      return ((await geo.json()) as { results?: Place[] }).results?.[0] ?? null;
    });
    // `null` is an unknown place or a failure that was already logged; a stale answer covers the latter.
    if (!found) return await staleAnswer();
    target = found;
  }

  const reading =
    (await attempt('open-meteo', label, logger, (signal) =>
      fetchOpenMeteo(target, fetchImpl, signal),
    )) ??
    (await attempt('met-norway', label, logger, (signal) =>
      fetchMetNorway(target, fetchImpl, signal),
    ));
  if (!reading) return await staleAnswer();
  const answer = weatherSentence(target, reading, locale);
  await kv.set(cacheKey, answer, WEATHER_CACHE_SECONDS);
  await kv.set(staleKey, answer, WEATHER_STALE_SECONDS);
  return answer;
}

export function weatherFallback(locale: 'vi' | 'en'): string {
  return locale === 'vi'
    ? 'Tớ chưa xem được thời tiết lúc này. Bạn thử lại sau ít phút nhé.'
    : "I can't reach the weather service right now. Try again in a few minutes.";
}

export const SearchCatalogArgsSchema = z.object({ query: z.string().trim().min(1).max(120) });
