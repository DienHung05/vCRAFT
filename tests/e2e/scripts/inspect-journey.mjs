import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

// Capture observations rather than expected-value assertions. Run from tests/e2e.
const base = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const output = path.resolve('../../docs/design/audits/300');
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const mode of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'phone', width: 390, height: 844 },
    { name: 'narrow-phone', width: 360, height: 780 },
    { name: 'reduced-motion', width: 1440, height: 900, reducedMotion: 'reduce' },
    { name: 'no-javascript', width: 1440, height: 900, javaScriptEnabled: false },
    { name: 'no-webgl', width: 1440, height: 900, noWebgl: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      colorScheme: 'light',
      reducedMotion: mode.reducedMotion ?? 'no-preference',
      javaScriptEnabled: mode.javaScriptEnabled ?? true,
    });
    if (mode.noWebgl) {
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          if (String(kind).includes('webgl')) return null;
          return original.call(this, kind, ...args);
        };
      });
    }
    await context.addInitScript(() => {
      window.journeyMeasurements = { longTasks: [], cls: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.journeyMeasurements.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: false });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.journeyMeasurements.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    const page = await context.newPage();
    await page.goto(`${base}/vi/truy-xuat/BT7K2QXM`, { waitUntil: 'networkidle' });
    const record = { mode: mode.name, width: mode.width };
    record.base = base;
    record.entries = await page.locator('[data-journey-entry]').count();
    record.overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    record.companionVisible = await page.locator('.journey-companion').isVisible();
    if (mode.javaScriptEnabled !== false) {
      // Exercise a real journal link before profiling so hydration is not counted as stage motion.
      for (const id of ['log-2', 'log-1']) {
        await page.locator(`#${id} h3 a`).focus();
        await page.waitForFunction(
          (expected) =>
            document.querySelector('[data-journey-entry][aria-current]')?.id === expected,
          id,
        );
      }
      record.enhanced = await page.locator('.production-journey').getAttribute('data-enhanced');
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => {
        window.journeyMeasurements.longTasks = [];
      });
      record.stages = [];
      for (const id of ['log-1', 'log-2', 'log-3', 'log-4', 'log-5', 'log-6', 'log-7']) {
        await page.locator(`#${id} h3 a`).focus();
        await page.waitForFunction(
          (expected) =>
            document.querySelector('[data-journey-entry][aria-current]')?.id === expected,
          id,
        );
        record.stages.push(
          await page.evaluate(() => ({
            focused: document.activeElement?.closest('[data-journey-entry]')?.id,
            current: document.querySelector('[data-journey-entry][aria-current]')?.id,
            illustration: document.querySelector('.journey-art')?.getAttribute('data-stage'),
            currentCount: document.querySelectorAll('[data-journey-entry][aria-current]').length,
          })),
        );
      }
      if (record.enhanced) {
        await page.mouse.wheel(0, 1);
        record.scrollStages = [];
        for (const id of ['log-1', 'log-2', 'log-3', 'log-4', 'log-5', 'log-6', 'log-7']) {
          await page
            .locator(`#${id}`)
            .evaluate((entry) => entry.scrollIntoView({ block: 'start' }));
          await page.waitForFunction(
            (expected) =>
              document.querySelector('[data-journey-entry][aria-current]')?.id === expected,
            id,
          );
          record.scrollStages.push(await page.locator('.journey-art').getAttribute('data-stage'));
        }
      }
      record.measurements = await page.evaluate(() => window.journeyMeasurements);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
    await page.locator('#log-2').scrollIntoViewIfNeeded();
    if (mode.javaScriptEnabled !== false) await page.locator('#log-2 h3 a').focus();
    await page.screenshot({
      path: path.join(output, `${mode.name}.jpg`),
      type: 'jpeg',
      quality: 78,
      animations: 'disabled',
    });
    await page.goto(`${base}/vi/san-pham/binh-hut-loc-men-lam-bt7k2qxm`, {
      waitUntil: 'networkidle',
    });
    record.summaryLinks = await page.locator('.journey-summary a').count();
    record.productOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await page.locator('.journey-summary').scrollIntoViewIfNeeded();
    if (mode.name === 'desktop') {
      await page.waitForFunction(() =>
        document.querySelector('.journey-summary')?.hasAttribute('data-play'),
      );
    }
    record.summaryPlayed = await page.locator('.journey-summary').getAttribute('data-play');
    await page.screenshot({
      path: path.join(output, `${mode.name}-summary.jpg`),
      type: 'jpeg',
      quality: 78,
      animations: 'disabled',
    });
    results.push(record);
    console.log(JSON.stringify(record));
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(path.join(output, 'observations.json'), `${JSON.stringify(results, null, 2)}\n`);
}
