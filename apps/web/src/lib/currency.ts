/**
 * USD reference price (FR-CAT-08, BR-07). Money is stored and charged in whole VND; the USD figure
 * is only an approximation for foreign visitors, converted at a rate that is refreshed daily.
 *
 * The daily rate is fetched on the web server (`lib/usd-rate.ts`) and handed to components through
 * `UsdRateProvider`. When the source is down or returns nonsense, the app falls back to the rate
 * configured here: `NEXT_PUBLIC_USD_VND_RATE` (VND per 1 USD), or `DEFAULT_USD_VND_RATE`.
 */
export const DEFAULT_USD_VND_RATE = 25_000;

/**
 * Plausible range for VND per 1 USD. A rate outside it is a broken feed (wrong units, an inverted
 * pair, a zero) and is ignored in favour of the fallback rather than shown to visitors.
 */
export const MIN_USD_VND_RATE = 10_000;
export const MAX_USD_VND_RATE = 60_000;

/** A VND-per-USD rate and the day it was published (`YYYY-MM-DD`), or null for the fallback rate. */
export type UsdRate = { rate: number; asOf: string | null };

/** Locales that show the USD reference next to a VND price. Vietnamese readers do not need it. */
export const USD_REFERENCE_LOCALES: readonly string[] = ['en'];

/** Whether a number is an acceptable VND-per-USD rate. */
export function isPlausibleUsdVndRate(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_USD_VND_RATE &&
    value <= MAX_USD_VND_RATE
  );
}

/** Reads a configured rate; anything that is not a positive finite number falls back to the default. */
export function parseUsdVndRate(raw: string | undefined): number {
  const value = Number(raw?.trim());
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_VND_RATE;
}

/** The configured rate, used until a daily rate is available and whenever the feed fails. */
export const FALLBACK_USD_RATE: UsdRate = {
  rate: parseUsdVndRate(process.env.NEXT_PUBLIC_USD_VND_RATE),
  asOf: null,
};

/**
 * Reads the `usd.json` payload of fawazahmed0/currency-api (`{ date: "YYYY-MM-DD", usd: { vnd } }`).
 * Returns null unless the date is well formed and the rate is plausible. The rate is rounded to a
 * whole VND so that the figure shown in the disclosure is the figure used for the conversion.
 */
export function parseUsdRatePayload(payload: unknown): UsdRate | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { date, usd } = payload as { date?: unknown; usd?: { vnd?: unknown } | null };
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return null;
  const rate = typeof usd?.vnd === 'number' ? Math.round(usd.vnd) : Number.NaN;
  return isPlausibleUsdVndRate(rate) ? { rate, asOf: date } : null;
}

/** Approximate USD value of a VND amount (not rounded; formatting decides the precision). */
export function vndToUsd(vnd: number, rate: number): number {
  return vnd / rate;
}

/** Whether a price in this locale should carry a USD reference. */
export function showsUsdReference(locale: string): boolean {
  return USD_REFERENCE_LOCALES.includes(locale);
}

/** Cents only matter for small amounts: "≈ US$0.80" but "≈ US$12". */
export function usdFractionDigits(usd: number): number {
  return Math.abs(usd) >= 10 ? 0 : 2;
}
