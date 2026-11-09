import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Read-only browser observations. No credentials, forms, or API writes.
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const output = process.env.FRONTEND_AUDIT_OUTPUT ?? '/tmp/vcraft-frontend';
const routes = (process.env.FRONTEND_AUDIT_ROUTES ?? '/vi').split(',');
const widths = (process.env.FRONTEND_AUDIT_WIDTHS ?? '360,768,1440').split(',').map(Number);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: 'no-preference',
      isMobile: width < 768,
      hasTouch: width < 768,
    });
    await context.addInitScript(() => {
      window.__audit = { frames: 0, lcp: 0, cls: 0 };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) =>
        raf((time) => {
          window.__audit.frames++;
          callback(time);
        });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__audit.lcp = entry.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__audit.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    for (const route of routes) {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
      await page.locator('main').waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1000);
      const first = await page.evaluate(() => ({
        ...window.__audit,
        ttfb: performance.getEntriesByType('navigation')[0].responseStart,
      }));
      const cursor = page.locator('main > [aria-hidden].fixed');
      let idleCursorMutations = null;
      if (await cursor.count()) {
        await page.mouse.move(100, 150);
        await page.mouse.move(200, 250);
        await page.waitForFunction(() =>
          document
            .querySelector('main > [aria-hidden].fixed')
            ?.style.transform.startsWith('translate3d(200px, 250px,'),
        );
        idleCursorMutations = await cursor.evaluate(async (el) => {
          let count = 0;
          const observer = new MutationObserver((records) => {
            count += records.length;
          });
          observer.observe(el, { attributes: true, attributeFilter: ['style'] });
          await new Promise((resolve) => setTimeout(resolve, 500));
          observer.disconnect();
          return count;
        });
      }
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const layout = await page.evaluate(() => {
        const main = document.querySelector('main');
        const footer = document.querySelector('footer');
        const news = document.querySelector('main ul.grid:has(article)');
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          mainHeight: Math.round(main.getBoundingClientRect().height),
          footerGap: footer
            ? Math.round(footer.getBoundingClientRect().top - main.getBoundingClientRect().bottom)
            : null,
          newsColumns: news ? getComputedStyle(news).gridTemplateColumns : null,
          images: [...main.querySelectorAll('img')].map((img) => ({
            alt: img.alt,
            complete: img.complete && img.naturalWidth > 0,
            rendered: Math.round(img.getBoundingClientRect().width),
            intrinsic: img.naturalWidth,
            loading: img.loading,
          })),
          headings: [...main.querySelectorAll('h1,h2')].map((el) => el.textContent),
          unavailable: Boolean(
            main.textContent.match(
              /chưa tải được|không thể tải|chưa thể tải|could not load|unable to load|unavailable/i,
            ),
          ),
        };
      });
      const name = route.replaceAll('/', '-').replace(/^-/, '');
      await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
      // content-visibility can omit offscreen sections from a full-page capture. Inspect each
      // real viewport too, without disabling the app's rendering optimizations.
      if (process.env.FRONTEND_AUDIT_SECTION_CAPTURES === '1') {
        const sections = page.locator('main > section');
        for (let index = 0; index < (await sections.count()); index++) {
          await sections.nth(index).scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${output}/${name}-${width}-section-${index}.png` });
        }
      }
      const record = {
        route,
        width,
        status: response.status(),
        ...first,
        idleCursorMutations,
        ...layout,
        errors,
      };
      if (process.env.FRONTEND_AUDIT_INTERACTIONS === '1') {
        const story = page.locator('.fire-story');
        record.interactions = {};
        if (await story.count()) {
          const stages = story.locator('.fire-track button');
          if (await stages.count()) {
            await stages.last().click();
            await page.waitForTimeout(800);
            record.interactions.stageJump = await page.evaluate(() => ({
              focused: document.activeElement?.getAttribute('data-fire-step'),
              current: document
                .querySelector('[data-fire-step][aria-current]')
                ?.getAttribute('data-fire-step'),
              drawing: document.querySelector('.fire-figure')?.getAttribute('data-piece-stage'),
            }));
            await page.setViewportSize({ width: 768, height: 900 });
            await page.waitForFunction(
              () => !document.querySelector('.fire-story')?.hasAttribute('data-fire-story'),
            );
            record.interactions.narrowResizeDisablesStory = true;
            await page.setViewportSize({ width, height: 900 });
          }
          if (width < 768) {
            await page.locator('nav a[href="#workshop"]').tap();
            record.interactions.visitTap = new URL(page.url()).hash === '#workshop';
          }
        }
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.waitForTimeout(200);
        record.interactions.reducedMotion = await page.evaluate(() => ({
          storyDisabled: !document.querySelector('.fire-story')?.hasAttribute('data-fire-story'),
          cursorAbsent: !document.querySelector('main > [aria-hidden].fixed'),
          vaseAnimation: document.querySelector('.turning-vase-spin')
            ? getComputedStyle(document.querySelector('.turning-vase-spin')).animationName
            : null,
        }));
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
      results.push(record);
      console.log(JSON.stringify(record));
    }
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(`${output}/observations.json`, `${JSON.stringify(results, null, 2)}\n`);
}
