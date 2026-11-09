import type { NextRequest, NextResponse } from 'next/server';

/**
 * True when the browser reached us over https. Behind a reverse proxy (Vercel, Render, nginx) the app
 * itself sees plain http, so the first `x-forwarded-proto` hop is authoritative; a spoofed value can
 * only make a cookie Secure, which is harmless.
 */
export function isHttpsRequest(request: NextRequest): boolean {
  return isHttpsProto(request.headers.get('x-forwarded-proto'), request.nextUrl.protocol);
}

/**
 * Adds `Secure` to every cookie on the response when the request came over https (GH#152). Decided per
 * request rather than from NODE_ENV so that a production build served over plain http (CI e2e on
 * http://localhost, a LAN demo) keeps working: browsers drop Secure cookies on non-localhost http.
 */
export function secureCookiesOnHttps(request: NextRequest, response: NextResponse): NextResponse {
  if (!isHttpsRequest(request)) return response;
  for (const cookie of response.cookies.getAll()) {
    if (!cookie.secure) response.cookies.set({ ...cookie, secure: true });
  }
  return response;
}

/** The first `x-forwarded-proto` hop (or the given fallback protocol) is https. Shared by every cookie writer. */
export function isHttpsProto(forwardedProto: string | null | undefined, fallback = ''): boolean {
  const proto = forwardedProto?.split(',')[0]?.trim().toLowerCase();
  return (proto || fallback.replace(':', '').toLowerCase()) === 'https';
}

/** Adds `secure: true` to cookie options when the connection is https; leaves them untouched otherwise. */
export function withSecureOnHttps<T extends object>(
  options: T | undefined,
  https: boolean,
): (T & { secure?: boolean }) | undefined {
  if (!https) return options;
  return { ...(options ?? ({} as T)), secure: true };
}
