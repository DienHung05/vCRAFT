/**
 * "Remember me" on sign-in. The Supabase `sb-*` auth cookies are persistent by default; when the visitor
 * unticks the box they are written as browser-session cookies instead (no `maxAge`, no `expires`), so
 * the session ends when the browser closes. The choice travels in a small session marker cookie that the
 * server (proxy, route handlers) and the browser client read at write time, so it also covers every
 * later silent refresh of the session.
 */

export const REMEMBER_COOKIE = 'vcraft-remember';

/** Marker value meaning "do not remember": the auth cookies become session cookies. */
const FORGET = '0';

interface Lifetime {
  maxAge?: number | undefined;
  expires?: Date | undefined;
}

/** A write that expires the cookie immediately (sign-out, cleanup) must keep its lifetime to delete it. */
function isDeletion({ maxAge, expires }: Lifetime): boolean {
  if (typeof maxAge === 'number' && maxAge <= 0) return true;
  return expires instanceof Date && expires.getTime() <= Date.now();
}

/**
 * Cookie options for an auth cookie under the visitor's remember preference. Remembered (or a deletion
 * write): the options pass through untouched. Not remembered: `maxAge` and `expires` are dropped.
 */
export function withRememberPolicy<T extends Lifetime>(
  options: T | undefined,
  remember: boolean,
): T | undefined {
  if (remember || !options || isDeletion(options)) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  return rest as unknown as T;
}

/** Reads the preference from a `getAll()`-shaped cookie list; remembered unless the marker says `0`. */
export function readRememberPreference(cookies: readonly { name: string; value: string }[]) {
  return cookies.find((cookie) => cookie.name === REMEMBER_COOKIE)?.value !== FORGET;
}

/**
 * Stores the preference for the next auth writes (browser only). Not remembering writes the session
 * marker; remembering removes it, since that is the default.
 */
export function setRememberPreference(remember: boolean): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: the sign-in must write the marker synchronously before the auth call; the async Cookie Store API is not available in every supported browser.
  document.cookie = remember
    ? `${REMEMBER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    : `${REMEMBER_COOKIE}=${FORGET}; Path=/; SameSite=Lax${secure}`;
}

/** Forgets the preference, e.g. after sign-out, so the next sign-in starts from the default. */
export function clearRememberPreference(): void {
  setRememberPreference(true);
}
