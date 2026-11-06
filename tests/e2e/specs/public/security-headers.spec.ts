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
    expect(headers['x-powered-by']).toBeUndefined();
  });
}

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
