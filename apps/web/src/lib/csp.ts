/**
 * Content-Security-Policy with a per-request nonce (NFR-SEC-04, GH#240). `proxy.ts` calls `generateNonce()`
 * for every page request, builds the policy with `contentSecurityPolicy()` and hands the nonce to Next
 * through the request's CSP header (Next stamps it on its own scripts) and through `x-nonce` (the root
 * layout stamps it on the inline bootstrap scripts it renders itself).
 *
 * `'strict-dynamic'` lets a nonced script load more scripts (Next chunks, the Turnstile widget) without any
 * host allowlist; browsers that support it ignore `'self'` and the listed hosts, older ones fall back to them.
 * Pure functions on the standard library only, so they run in the proxy runtime and in unit tests.
 */

/** Request header carrying the nonce from `proxy.ts` to Server Components. */
export const NONCE_HEADER = 'x-nonce';

/** 128 random bits, base64 encoded. A fresh value for every request. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export interface CspOptions {
  nonce: string;
  /** `next dev` needs `'unsafe-eval'` (React rebuilds server stacks in the browser) and the HMR socket. */
  isDev?: boolean;
  /** `NEXT_PUBLIC_SUPABASE_URL`: the browser talks to Supabase Auth and Realtime directly. */
  supabaseUrl?: string | undefined;
  /** Extra URLs the village map fetches from (`NEXT_PUBLIC_MAP_STYLE_URL`, `_PMTILES_URL`, `_GLYPHS_URL`). */
  mapUrls?: readonly (string | undefined)[];
}

const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
/** Default map sources, see `features/village-map/offline-style.ts` and `features/auth/location-map.tsx`. */
const DEFAULT_MAP_ORIGINS = [
  'https://tiles.openfreemap.org',
  'https://protomaps.github.io',
  'https://tile.openstreetmap.org',
] as const;

/** Origin of a URL (a `{fontstack}` style template is fine), or null when it is empty or not a URL. */
function originOf(url: string | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const { origin } = new URL(trimmed.replace(/^pmtiles:\/\//, ''));
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

/** `https://<ref>.supabase.co` -> that origin plus its `wss://` twin for Realtime. */
function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  const origin = originOf(supabaseUrl);
  if (!origin) return [];
  const { protocol, host } = new URL(origin);
  return protocol === 'https:' ? [origin, `wss://${host}`] : [origin];
}

export function contentSecurityPolicy({
  nonce,
  isDev = false,
  supabaseUrl,
  mapUrls = [],
}: CspOptions): string {
  const mapOrigins = mapUrls.map(originOf).filter((origin): origin is string => origin !== null);
  const connect = new Set([
    "'self'",
    ...supabaseOrigins(supabaseUrl),
    ...DEFAULT_MAP_ORIGINS,
    ...mapOrigins,
    TURNSTILE_ORIGIN,
    ...(isDev ? ['ws:', 'wss:'] : []),
  ]);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      TURNSTILE_ORIGIN,
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Inline styles stay allowed: React and MapLibre write `style=""` attributes, which a nonce cannot cover.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Product and workshop photos, Storage files and map raster tiles come from several https hosts.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': [...connect],
    'frame-src': [TURNSTILE_ORIGIN],
    // MapLibre runs its tile decoder in a blob or same-origin worker.
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** The policy for this deployment, read from the same `NEXT_PUBLIC_*` variables the browser code uses. */
export function contentSecurityPolicyFromEnv(nonce: string): string {
  return contentSecurityPolicy({
    nonce,
    isDev: process.env.NODE_ENV === 'development',
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mapUrls: [
      process.env.NEXT_PUBLIC_MAP_STYLE_URL,
      process.env.NEXT_PUBLIC_MAP_PMTILES_URL,
      process.env.NEXT_PUBLIC_MAP_GLYPHS_URL,
    ],
  });
}
