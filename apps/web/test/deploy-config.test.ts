import { describe, expect, it } from 'vitest';
import {
  apiRewrites,
  sameOriginMediaUrl,
  securityHeaders,
  storageUrlFor,
} from '../src/lib/deploy-config';

const SUPABASE = 'https://ref.supabase.co';

describe('storageUrlFor', () => {
  it('maps a /media-cache path onto the project public Storage', () => {
    expect(storageUrlFor(['media', 'v', 'a b', '640.avif'], SUPABASE)).toBe(
      'https://ref.supabase.co/storage/v1/object/public/media/v/a%20b/640.avif',
    );
    expect(storageUrlFor(['m', '1.avif'], `${SUPABASE}/some/path`)).toBe(
      'https://ref.supabase.co/storage/v1/object/public/m/1.avif',
    );
  });

  it('refuses traversal, empty paths and a missing or malformed project URL', () => {
    expect(storageUrlFor(['..', 'x'], SUPABASE)).toBeNull();
    expect(storageUrlFor(['a', '', 'x'], SUPABASE)).toBeNull();
    expect(storageUrlFor([], SUPABASE)).toBeNull();
    expect(storageUrlFor(['a'], undefined)).toBeNull();
    expect(storageUrlFor(['a'], 'not a url')).toBeNull();
  });
});

describe('sameOriginMediaUrl', () => {
  it('rewrites public Storage URLs of the project and leaves every other URL alone', () => {
    const url = `${SUPABASE}/storage/v1/object/public/media/v/1280.avif`;
    expect(sameOriginMediaUrl(url, SUPABASE)).toBe('/media-cache/media/v/1280.avif');
    expect(sameOriginMediaUrl('https://other.test/a.avif', SUPABASE)).toBe(
      'https://other.test/a.avif',
    );
    expect(sameOriginMediaUrl('/images/demo/a.webp', SUPABASE)).toBe('/images/demo/a.webp');
    expect(sameOriginMediaUrl(url, undefined)).toBe(url);
  });
});

describe('apiRewrites', () => {
  it('chỉ lấy origin của API_INTERNAL_URL, bỏ tiền tố /api/v1', () => {
    expect(apiRewrites('https://vcraft-api.onrender.com/api/v1', true)).toEqual([
      { source: '/api/:path*', destination: 'https://vcraft-api.onrender.com/api/:path*' },
    ]);
  });

  it('dev không đặt biến thì trỏ localhost:4000; production không đặt thì không rewrite', () => {
    expect(apiRewrites(undefined, false)[0]?.destination).toBe('http://localhost:4000/api/:path*');
    expect(apiRewrites('  ', true)).toEqual([]);
  });
});

describe('securityHeaders', () => {
  it('đặt HSTS, nosniff, Referrer-Policy, Permissions-Policy và CSP cho mọi đường dẫn', () => {
    const [rule] = securityHeaders();
    expect(rule?.source).toBe('/:path*');
    expect(rule?.headers.map((h) => h.key)).toEqual([
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Content-Security-Policy',
    ]);
  });
});
