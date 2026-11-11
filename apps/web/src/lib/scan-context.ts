/**
 * Country of the scanner from the edge header `x-vercel-ip-country` (FR-TRC-06): a two-letter ISO code, or
 * `null` when the header is missing or malformed. The IP address itself is never read, sent or stored.
 */
export function scanCountry(header: string | null): string | null {
  const code = header?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

// The classifier lives in `@vcraft/contracts` so the API applies the same rule as this route (GH#483).
export { isAutomatedUserAgent, isPrefetchRequest, scanDeviceType } from '@vcraft/contracts';
