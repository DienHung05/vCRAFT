type Headers = Readonly<Record<string, string | string[] | undefined>>;

const header = (headers: Headers, name: string): string | undefined => {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/** Browser families in the order their User-Agent tokens must be tested (Edge and Opera also say Chrome). */
const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\b(?:Edg|EdgA|EdgiOS)\//, 'Edge'],
  [/\bOPR\//, 'Opera'],
  [/\b(?:Firefox|FxiOS)\//, 'Firefox'],
  [/\b(?:Chrome|CriOS)\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
];

/** Systems, Android and iOS before the Linux and Mac tokens they also carry. */
const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\bWindows\b/, 'Windows'],
  [/\bAndroid\b/, 'Android'],
  [/\b(?:iPhone|iPad|iPod)\b/, 'iOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bLinux\b/, 'Linux'],
];

/**
 * A coarse "Chrome · Windows" label from the User-Agent for the sign-in history (FR-AUTH-05). Only the
 * browser family and the system are kept, never the version string or anything that identifies a device.
 */
export function describeClient(userAgent: string | undefined): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const label = [browser, system].filter(Boolean).join(' · ');
  return label === '' ? null : label;
}

/** Headers a hosting edge sets with the visitor's country; the first one present wins. */
const COUNTRY_HEADERS = ['x-vercel-ip-country', 'cf-ipcountry', 'cloudfront-viewer-country'];

/**
 * The ISO 3166-1 alpha-2 country the hosting edge reports for the request (FR-AUTH-05 "rough location").
 * The IP address itself is never read or stored.
 */
export function edgeCountry(headers: Headers): string | null {
  for (const name of COUNTRY_HEADERS) {
    const value = header(headers, name)?.trim().toUpperCase();
    // XX = unknown and T1 = Tor in Cloudflare's scheme.
    if (value && /^[A-Z]{2}$/.test(value) && value !== 'XX' && value !== 'T1') return value;
  }
  return null;
}

/** Browser label and country of one request, as stored with a `LoginEvent`. */
export function clientHints(headers: Headers): { browser: string | null; country: string | null } {
  return {
    browser: describeClient(header(headers, 'user-agent')),
    country: edgeCountry(headers),
  };
}
