import type { ScanDeviceTypeDto } from './index';

/**
 * Automated clients that fetch `/q/<code>` without a person scanning: search and social crawlers, link
 * previews (Facebook, Slack, Telegram, WhatsApp, Twitter/X, Discord, LinkedIn, Skype), HTTP libraries and
 * headless browsers. The generic `bot|crawl|spider|preview` words cover Googlebot, bingbot, Slackbot,
 * TelegramBot, Twitterbot, Discordbot and most others without listing each one (GH#483).
 */
const BOT =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|preview|headless|lighthouse|curl|wget|python-requests|whatsapp\/|go-http-client|node-fetch|undici|axios|libwww|httpclient|scrapy|embedly|pinterest|vkshare|uptime|pingdom/i;
const TABLET = /ipad|tablet|android(?!.*mobile)/i;
const MOBILE = /mobi|iphone|ipod|android/i;

/** Coarse device class from the User-Agent (FR-TRC-06); the User-Agent itself is never stored. */
export function scanDeviceType(userAgent: string | null | undefined): ScanDeviceTypeDto {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return 'unknown';
  if (BOT.test(ua)) return 'bot';
  if (TABLET.test(ua)) return 'tablet';
  if (MOBILE.test(ua)) return 'mobile';
  return 'desktop';
}

/** True when the User-Agent belongs to an automated client (a crawler or link-preview fetcher). */
export function isAutomatedUserAgent(userAgent: string | null | undefined): boolean {
  return scanDeviceType(userAgent) === 'bot';
}

/** Minimal header reader, satisfied by `Headers`. */
interface HeaderReader {
  get(name: string): string | null;
}

/**
 * True for a request the browser or a proxy makes speculatively, not because a person opened the link:
 * `HEAD`, `Purpose` / `Sec-Purpose: prefetch|prerender`, `X-Moz: prefetch`, `X-Purpose: preview` and
 * Next.js `Next-Router-Prefetch`. Such a request still gets its redirect but never counts as a scan.
 */
export function isPrefetchRequest(method: string | undefined, headers: HeaderReader): boolean {
  if (method?.toUpperCase() === 'HEAD') return true;
  const purpose = ['purpose', 'sec-purpose', 'x-moz', 'x-purpose']
    .map((name) => headers.get(name) ?? '')
    .join(' ');
  if (/prefetch|prerender|preview/i.test(purpose)) return true;
  const next = headers.get('next-router-prefetch');
  return next !== null && next !== '' && next !== '0';
}

/**
 * Whether a scan report is machine traffic and must not be stored or counted: the web already classified
 * it (`deviceType: 'bot'`), or the forwarded User-Agent says so.
 */
export function isAutomatedScan(
  deviceType: ScanDeviceTypeDto | null | undefined,
  userAgent?: string | null,
): boolean {
  return deviceType === 'bot' || isAutomatedUserAgent(userAgent);
}
