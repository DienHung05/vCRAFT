import { describe, expect, it } from 'vitest';
import { isHttpsProto, withSecureOnHttps } from '@/lib/secure-cookies';

describe('withSecureOnHttps', () => {
  it('adds secure and keeps the other options on https', () => {
    expect(withSecureOnHttps({ path: '/', sameSite: 'lax' as const, maxAge: 60 }, true)).toEqual({
      path: '/',
      sameSite: 'lax',
      maxAge: 60,
      secure: true,
    });
    expect(withSecureOnHttps(undefined, true)).toEqual({ secure: true });
  });

  it('leaves options untouched on http so local dev keeps working', () => {
    const options = { path: '/', sameSite: 'lax' as const };
    expect(withSecureOnHttps(options, false)).toBe(options);
    expect(withSecureOnHttps(undefined, false)).toBeUndefined();
  });
});

describe('isHttpsProto', () => {
  it('uses the first forwarded hop, then the fallback protocol', () => {
    expect(isHttpsProto('https, http')).toBe(true);
    expect(isHttpsProto('http, https')).toBe(false);
    expect(isHttpsProto(null, 'https:')).toBe(true);
    expect(isHttpsProto(null, 'http:')).toBe(false);
    expect(isHttpsProto(null)).toBe(false);
  });
});
