import { expect, test } from '@playwright/test';

/**
 * Issue #97 (PLAN E14, NFR-SEC): the security headers from `apps/web/src/lib/deploy-config.ts` and the
 * flags of any cookie the public site sets, checked on the running web app (CI runs the production build).
 */
const PAGES = ['/vi', '/en/products', '/vi/truy-xuat/DF6P3WZE'];

for (const path of PAGES) {
  test(`security headers on ${path}`, async ({ request }) => {
    const res = await request.get(path, { maxRedirects: 0 });
    const headers = res.headers();
    expect(headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('microphone=()');
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("object-src 'none'");
    // NFR-SEC-04 (GH#240): scripts run only with this request's nonce, never through 'unsafe-inline'.
    const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(headers['x-powered-by']).toBeUndefined();
  });
}

test('every inline script carries the nonce of its own response, and the nonce changes per request', async ({
  request,
}) => {
  const nonces: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await request.get('/vi', { maxRedirects: 0 });
    const nonce = /'nonce-([^']+)'/.exec(res.headers()['content-security-policy'] ?? '')?.[1];
    expect(nonce).toBeTruthy();
    const html = await res.text();
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) {
      if (/type="application\/ld\+json"/.test(tag)) continue;
      expect(tag, 'script tag without the response nonce').toContain(`nonce="${nonce}"`);
    }
    nonces.push(nonce ?? '');
  }
  expect(nonces[0]).not.toBe(nonces[1]);
});

test('cookies set by public pages are SameSite and never readable cross-site', async ({
  page,
  baseURL,
}) => {
  await page.goto('/vi');
  await page.goto('/en/products');
  const secureOrigin = (baseURL ?? '').startsWith('https://');
  for (const cookie of await page.context().cookies()) {
    expect(['Lax', 'Strict'], `${cookie.name} SameSite`).toContain(cookie.sameSite);
    expect(cookie.path, `${cookie.name} path`).toBe('/');
    if (secureOrigin) expect(cookie.secure, `${cookie.name} Secure`).toBe(true);
    // Session cookies only appear after signing in; a public visit must not create one.
    expect(cookie.name).not.toMatch(/auth-token/);
  }
});
