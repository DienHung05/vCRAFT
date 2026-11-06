// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';
import { isHttpsRequest, secureCookiesOnHttps } from '@/lib/secure-cookies';

const req = (url: string, headers: Record<string, string> = {}) =>
  new NextRequest(url, { headers });

const withLocale = () => {
  const res = NextResponse.next();
  res.cookies.set('NEXT_LOCALE', 'en', { sameSite: 'lax', path: '/' });
  return res;
};

describe('isHttpsRequest', () => {
  it('trusts the first x-forwarded-proto hop behind a reverse proxy', () => {
    expect(isHttpsRequest(req('http://internal:3000/', { 'x-forwarded-proto': 'https' }))).toBe(
      true,
    );
    expect(
      isHttpsRequest(req('http://internal:3000/', { 'x-forwarded-proto': 'https, http' })),
    ).toBe(true);
    expect(isHttpsRequest(req('https://internal:3000/', { 'x-forwarded-proto': 'http' }))).toBe(
      false,
    );
  });

  it('falls back to the request URL protocol', () => {
    expect(isHttpsRequest(req('https://vcraft.test/'))).toBe(true);
    expect(isHttpsRequest(req('http://localhost:3000/'))).toBe(false);
  });
});

describe('secureCookiesOnHttps (GH#152)', () => {
  it('marks NEXT_LOCALE Secure on https and keeps its other attributes', () => {
    const res = secureCookiesOnHttps(req('https://vcraft.test/'), withLocale());
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toContain('NEXT_LOCALE=en');
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=lax/i);
    expect(header).toContain('Path=/');
  });

  it('leaves cookies untouched on plain http so local dev and CI keep working', () => {
    const res = secureCookiesOnHttps(req('http://localhost:3000/'), withLocale());
    expect(res.headers.get('set-cookie')).not.toMatch(/Secure/i);
  });
});
