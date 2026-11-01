/**
 * USD reference price (FR-CAT-08, BR-07). Money is stored and charged in whole VND; the USD figure
 * is only an approximation for foreign visitors.
 *
 * The SRS asks for a daily exchange rate but no rate feed is wired up yet, so there is one rate for
 * the whole app: `NEXT_PUBLIC_USD_VND_RATE` (VND per 1 USD, inlined at build time) with a fallback
 * to `DEFAULT_USD_VND_RATE`. Change it there only; nothing else hard-codes a rate.
 */
export const DEFAULT_USD_VND_RATE = 25_000;

/** Locales that show the USD reference next to a VND price. Vietnamese readers do not need it. */
export const USD_REFERENCE_LOCALES: readonly string[] = ['en'];

/** Reads a configured rate; anything that is not a positive finite number falls back to the default. */
export function parseUsdVndRate(raw: string | undefined): number {
  const value = Number(raw?.trim());
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_USD_VND_RATE;
}

/** VND per 1 USD used by the whole app. */
export const USD_VND_RATE = parseUsdVndRate(process.env.NEXT_PUBLIC_USD_VND_RATE);

/** Approximate USD value of a VND amount (not rounded; formatting decides the precision). */
export function vndToUsd(vnd: number, rate: number = USD_VND_RATE): number {
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
