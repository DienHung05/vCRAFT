import { FALLBACK_USD_RATE, parseUsdRatePayload, type UsdRate } from './currency';

/**
 * Daily USD/VND reference rate (BR-07), fetched on the web server.
 *
 * Source: fawazahmed0/currency-api, served from the jsDelivr CDN with a Cloudflare Pages mirror.
 * It needs no API key, has no rate limit or attribution requirement, publishes one dated rate per
 * day, and the `usd.json` file is small (a few KB). Both hosts serve the same file, so the mirror
 * is only tried when the CDN fails.
 *
 * Next's data cache (`revalidate`) keeps the response for 24h, so the pages that read it stay
 * statically cacheable and visitors never trigger a request to the source. If every source fails
 * or returns an implausible rate, the configured fallback rate is used (see `lib/currency.ts`).
 */
export const USD_RATE_SOURCES: readonly string[] = [
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
  'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
];

/** How long Next may reuse a fetched rate: one day, matching the daily source. */
export const USD_RATE_REVALIDATE_SECONDS = 86_400;

/** A slow source must not hold up a render, so give up quickly and try the next one. */
const SOURCE_TIMEOUT_MS = 3_000;

/** Returns the daily rate, or the configured fallback. Never throws. */
export async function getUsdRate(): Promise<UsdRate> {
  for (const url of USD_RATE_SOURCES) {
    try {
      const response = await fetch(url, {
        next: { revalidate: USD_RATE_REVALIDATE_SECONDS },
        signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
      });
      if (!response.ok) continue;
      const parsed = parseUsdRatePayload(await response.json());
      if (parsed) return parsed;
    } catch {
      // Network error, timeout or invalid JSON: try the next source, then fall back.
    }
  }
  return FALLBACK_USD_RATE;
}
