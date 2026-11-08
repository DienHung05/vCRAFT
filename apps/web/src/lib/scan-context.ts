import type { ScanDeviceTypeDto } from '@vcraft/contracts';

/**
 * Country of the scanner from the edge header `x-vercel-ip-country` (FR-TRC-06): a two-letter ISO code, or
 * `null` when the header is missing or malformed. The IP address itself is never read, sent or stored.
 */
export function scanCountry(header: string | null): string | null {
  const code = header?.trim().toUpperCase() ?? '';
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

const BOT =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python-requests/i;
const TABLET = /ipad|tablet|android(?!.*mobile)/i;
const MOBILE = /mobi|iphone|ipod|android/i;

/** Coarse device class from the User-Agent (FR-TRC-06); the User-Agent itself is never stored. */
export function scanDeviceType(userAgent: string | null): ScanDeviceTypeDto {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return 'unknown';
  if (BOT.test(ua)) return 'bot';
  if (TABLET.test(ua)) return 'tablet';
  if (MOBILE.test(ua)) return 'mobile';
  return 'desktop';
}
