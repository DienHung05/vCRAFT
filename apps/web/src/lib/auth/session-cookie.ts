/**
 * Whether the browser holds a Supabase auth cookie (`sb-<ref>-auth-token`, possibly chunked as `.0`,
 * `.1`). Guests have none, so the public header can settle as "guest" without downloading the Supabase
 * SDK; the same `sb-` prefix check is what `proxy-session.ts` uses on the server. The cookie is written
 * by `@supabase/ssr` through `document.cookie`, so it is readable here.
 */
export function hasAuthCookie(cookieHeader: string): boolean {
  return cookieHeader.split(';').some((part) => {
    const name = part.split('=')[0]?.trim() ?? '';
    return name.startsWith('sb-') && name.includes('-auth-token');
  });
}
