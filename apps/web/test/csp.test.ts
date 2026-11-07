import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, contentSecurityPolicyFromEnv, generateNonce } from '../src/lib/csp';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(' ') ?? [];

describe('generateNonce', () => {
  it('returns a different base64 value of 128 bits for every call', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });
});

describe('contentSecurityPolicy', () => {
  const nonce = 'abc123==';

  it('allows scripts only through the nonce and strict-dynamic, without unsafe-inline', () => {
    const scripts = directive(contentSecurityPolicy({ nonce }), 'script-src');
    expect(scripts).toContain(`'nonce-${nonce}'`);
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it('allows unsafe-eval and the HMR socket in development only', () => {
    const dev = contentSecurityPolicy({ nonce, isDev: true });
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toContain('ws:');
    const prod = contentSecurityPolicy({ nonce });
    expect(directive(prod, 'connect-src')).not.toContain('ws:');
  });

  it('keeps inline styles allowed because style attributes cannot carry a nonce', () => {
    expect(directive(contentSecurityPolicy({ nonce }), 'style-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
    ]);
  });

  it('keeps the framing, base URI and plugin lockdown', () => {
    const csp = contentSecurityPolicy({ nonce });
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
  });

  it('lets the browser reach Supabase (HTTP and Realtime), the map sources and Turnstile', () => {
    const csp = contentSecurityPolicy({
      nonce,
      supabaseUrl: 'https://ref.supabase.co',
      mapUrls: [
        'https://tiles.example.com/styles/brand.json',
        'https://cdn.example.com/bat-trang.pmtiles',
        'https://glyphs.example.com/fonts/{fontstack}/{range}.pbf',
        '',
        undefined,
      ],
    });
    const connect = directive(csp, 'connect-src');
    expect(connect).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://ref.supabase.co',
        'wss://ref.supabase.co',
        'https://tiles.openfreemap.org',
        'https://tiles.example.com',
        'https://cdn.example.com',
        'https://glyphs.example.com',
        'https://challenges.cloudflare.com',
      ]),
    );
    expect(directive(csp, 'frame-src')).toEqual(['https://challenges.cloudflare.com']);
    expect(directive(csp, 'worker-src')).toEqual(["'self'", 'blob:']);
    expect(directive(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:', 'https:']);
  });

  it('ignores a map or Supabase URL that is not a URL', () => {
    const connect = directive(
      contentSecurityPolicy({ nonce, supabaseUrl: 'not a url', mapUrls: ['also not'] }),
      'connect-src',
    );
    expect(connect.filter((source) => source.includes('not'))).toEqual([]);
  });

  it('does not repeat a connect-src origin', () => {
    const connect = directive(
      contentSecurityPolicy({ nonce, mapUrls: ['https://tiles.openfreemap.org/styles/liberty'] }),
      'connect-src',
    );
    expect(connect.filter((source) => source === 'https://tiles.openfreemap.org')).toHaveLength(1);
  });

  it('reads the Supabase and map variables from the environment', () => {
    const csp = contentSecurityPolicyFromEnv(nonce);
    expect(directive(csp, 'script-src')).toContain(`'nonce-${nonce}'`);
  });
});
