import type { NextRequest, NextResponse } from 'next/server';

/**
 * True when the browser reached us over https. Behind a reverse proxy (Vercel, Render, nginx) the app
 * itself sees plain http, so the first `x-forwarded-proto` hop is authoritative; a spoofed value can
 * only make a cookie Secure, which is harmless.
 */
export function isHttpsRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return (forwarded ?? request.nextUrl.protocol.replace(':', '')) === 'https';
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
