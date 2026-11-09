// GH#301 audit capture: before/after screenshots + overflow probes for public routes.
// Usage: node tests/e2e/scripts/audit-301.mjs --out docs/design/audits/301/before --label before
//        node tests/e2e/scripts/audit-301.mjs --out ... --only home,truy-xuat   (subset by id)
//        node tests/e2e/scripts/audit-301.mjs --out ... --only nothing --path id=/vi/some/slug (extras)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { PUBLIC_ROUTES } from './public-routes.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const outDir = arg('out', 'docs/design/audits/301/before');
const label = arg('label', 'before');
const base = arg('base', 'http://localhost:3000');
const only = process.argv.includes('--only') ? arg('only', '') : null;

const ROUTES = PUBLIC_ROUTES;
const routes = only ? ROUTES.filter((r) => only.split(',').includes(r.id)) : ROUTES;
// Extra explicit routes: --path id=/vi/nghe-nhan/some-slug (repeatable).
const extras = process.argv
  .map((a, i) => (a === '--path' ? process.argv[i + 1] : null))
  .filter(Boolean)
  .map((pair) => {
    const eq = pair.indexOf('=');
    return { id: pair.slice(0, eq), path: pair.slice(eq + 1) };
  });
routes.push(...extras);
const SIZES = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390', width: 390, height: 844 },
];

const _slugOf = (href) => decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
const detailHrefFrom = async (page, pathPrefix) =>
  page.evaluate((prefix) => {
    const a = [...document.querySelectorAll(`a[href^="${prefix}/"]`)].find(
      (el) => el.getAttribute('href')?.length > prefix.length + 1,
    );
    return a ? a.getAttribute('href') : null;
  }, pathPrefix);

mkdirSync(outDir, { recursive: true });
const report = [];
const browser = await chromium.launch();
for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  for (const route of routes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    const t0 = Date.now();
    const response = await page.goto(base + route.path, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    const destination = new URL(page.url());
    const expectedPath = route.signedOutPath ?? route.path;
    if (
      !response?.ok() ||
      destination.pathname !== expectedPath ||
      (route.signedOutPath && destination.searchParams.get('next') !== route.path)
    ) {
      throw new Error(`Invalid capture for ${route.id}: ${response?.status()} at ${page.url()}`);
    }
    await page.locator('h1').first().waitFor({ state: 'visible' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    // Scroll through to trigger scroll reveals, then back to top.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const file = join(outDir, `${label}--${route.id}--${size.name}.jpg`);
    const screenshot = await page.screenshot({
      path: file,
      fullPage: true,
      type: 'jpeg',
      quality: 72,
    });
    const capture = await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${encoded}`;
      await image.decode();
      return {
        url: location.href,
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        imageWidth: image.naturalWidth,
        imageHeight: image.naturalHeight,
      };
    }, screenshot.toString('base64'));
    if (capture.imageWidth !== size.width || capture.scrollWidth > capture.clientWidth) {
      throw new Error(`Capture width mismatch for ${route.id}: ${JSON.stringify(capture)}`);
    }
    // Overflow probe at 360 only on the phone pass.
    let overflow360 = null;
    if (size.name === '390') {
      await page.setViewportSize({ width: 360, height: 780 });
      await page.waitForTimeout(300);
      overflow360 = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        offenders: [...document.querySelectorAll('body *')]
          .filter(
            (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 1,
          )
          .slice(0, 5)
          .map(
            (el) =>
              `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ').slice(0, 2).join('.')}` : ''}`,
          ),
      }));
    }
    report.push({
      route: route.id,
      size: size.name,
      status: response.status(),
      state: route.signedOutPath ? 'signed-out redirect' : 'public page',
      requestedPath: route.path,
      capture,
      ms: Date.now() - t0,
      overflow360,
    });
    console.log(`captured ${route.id} @${size.name}`);
  }
  await ctx.close();
}
// Discover one real artisan household slug and one news slug from list pages at desktop.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page
  .goto(`${base}/vi/nghe-nhan`, { waitUntil: 'networkidle', timeout: 45000 })
  .catch(() => {});
const household = await detailHrefFrom(page, '/vi/nghe-nhan');
await page.goto(`${base}/vi/tin-tuc`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
const news = await detailHrefFrom(page, '/vi/tin-tuc');
await ctx.close();
await browser.close();
writeFileSync(
  join(outDir, `${label}-routes.json`),
  JSON.stringify({ report, household, news }, null, 2),
);
console.log(JSON.stringify({ household, news }));
