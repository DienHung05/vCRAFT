import { describe, expect, it } from 'vitest';
import { apiRewrites, securityHeaders } from '../src/lib/deploy-config';

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
