import AxeBuilder from '@axe-core/playwright';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { DEMO, type DemoAccountKey, loginContext } from './support/demo-session';

/**
 * UI quality pass (GH#38, part A) for the signed-in areas: buyer, Studio, admin and the account page.
 * Per page: axe (WCAG 2.2 AA) reports nothing serious or critical, no horizontal scroll at 360, 768,
 * 1280 and 1536 px, and no content poking out of the viewport. Plus targeted checks: the public header
 * keeps the nav on one line at 1280 px, the Studio tab bar fits a phone, menus close on Escape.
 *
 * Runs only with DEMO_PREEXAM=1 and the demo accounts' passwords (`DEMO_*_PASSWORD`) in the environment.
 * Run:  DEMO_PREEXAM=1 pnpm demo:e2e:preexam   (E2E_BASE_URL points it at a deployment; default local web)
 * Read-only: it only opens pages, it never submits a form.
 */
test.skip(!process.env.DEMO_PREEXAM, 'Set DEMO_PREEXAM=1 to run the pre-exam checks.');

const WIDTHS = [360, 768, 1280, 1536] as const;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

interface Area {
  account: DemoAccountKey;
  pages: readonly string[];
}

const AREAS: Record<string, Area> = {
  buyer: {
    account: 'buyer',
    pages: [
      '/vi/yeu-cau-bao-gia',
      '/vi/yeu-cau-bao-gia/moi',
      `/vi/yeu-cau-bao-gia/${DEMO.requests.biddingToAccept}`,
      '/vi/tai-khoan',
    ],
  },
  studio: {
    account: 'household',
    pages: [
      '/vi/studio',
      '/vi/studio/san-pham',
      '/vi/studio/san-pham/moi',
      '/vi/studio/bao-gia',
      `/vi/studio/de-xuat-tham-gia/${DEMO.requests.biddingToAccept}`,
      '/vi/studio/don-hang',
      '/vi/studio/ho-so',
    ],
  },
  admin: {
    account: 'admin',
    pages: [
      '/vi/admin',
      '/vi/admin/duyet-ho',
      `/vi/admin/duyet-ho/${DEMO.pendingHouseholdId}`,
      '/vi/admin/dieu-phoi',
      `/vi/admin/dieu-phoi/${DEMO.requests.inProduction}`,
      '/vi/admin/tin-tuc',
      '/vi/admin/tin-tuc/moi',
      '/vi/admin/nhat-ky',
    ],
  },
};

function missingCredentials(): string | undefined {
  const supabase =
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!supabase) return 'Missing SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY.';
  const missing = Object.values(DEMO.accounts)
    .map((account) => account.passwordEnv)
    .filter((name) => !process.env[name]);
  return missing.length > 0 ? `Missing demo passwords: ${missing.join(', ')}.` : undefined;
}

/** Elements that stick out past the right edge of the viewport and are not inside a scroller. */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth + 1;
    const out: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= limit) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.visibility === 'hidden') continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) {
          clipped = true;
          break;
        }
      }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    }
    return out.slice(0, 5);
  });
}

async function openAs(
  context: BrowserContext,
  path: string,
  width: number,
  height = 900,
): Promise<Page> {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  // Not `networkidle` (GH#258): signed-in pages keep the `/me/events` SSE stream open, so the network never
  // goes idle. Wait for the document, then for the page's first heading and the web fonts, which is when the
  // layout these checks measure has settled.
  await page.goto(path, { waitUntil: 'load' });
  await page.locator('main').getByRole('heading').first().waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return page;
}

for (const [name, area] of Object.entries(AREAS)) {
  test.describe(`signed-in area: ${name}`, () => {
    test.skip(missingCredentials() !== undefined, missingCredentials() ?? '');
    test.use({ locale: 'vi-VN' });

    let context: BrowserContext;

    test.beforeAll(async ({ browser, baseURL }) => {
      const base = (baseURL ?? '').replace(/\/$/, '');
      context = await browser.newContext({ baseURL: base, locale: 'vi-VN' });
      await loginContext(context, area.account, base);
    });

    test.afterAll(async () => {
      await context?.close();
    });

    for (const path of area.pages) {
      test(`${path}: no serious or critical axe issues`, async () => {
        const page = await openAs(context, path, 360);
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(blocking.map((v) => `${v.id} (${v.nodes[0]?.target.join(' ')})`)).toEqual([]);
        await page.close();
      });

      for (const width of WIDTHS) {
        test(`${path} @${width}px: no horizontal scroll and nothing clipped`, async () => {
          const page = await openAs(context, path, width);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `page is ${overflow}px wider than the viewport`).toBeLessThanOrEqual(0);
          expect(await overflowingElements(page)).toEqual([]);
          await page.close();
        });
      }
    }
  });
}

test.describe('header with a signed-in account', () => {
  test.skip(missingCredentials() !== undefined, missingCredentials() ?? '');
  test.use({ locale: 'vi-VN' });

  for (const locale of ['vi', 'en'] as const) {
    test(`1280px, signed in (${locale}): nav links stay on one line`, async ({
      browser,
      baseURL,
    }) => {
      const base = (baseURL ?? '').replace(/\/$/, '');
      const context = await browser.newContext({ baseURL: base });
      await loginContext(context, 'buyer', base);
      const page = await openAs(context, `/${locale}`, 1280);
      const links = page.locator('header nav').first().getByRole('link');
      expect(await links.count()).toBeGreaterThanOrEqual(5);
      const heights = await links.evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().height)),
      );
      // A one-line link is ~36px tall (py-2 + 21px line); a wrapped one is at least ~57px.
      expect(Math.max(...heights)).toBeLessThanOrEqual(40);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await context.close();
    });
  }

  for (const locale of ['vi', 'en'] as const) {
    test(`Studio tab bar fits a 360px phone (${locale})`, async ({ browser, baseURL }) => {
      const base = (baseURL ?? '').replace(/\/$/, '');
      const context = await browser.newContext({ baseURL: base });
      await loginContext(context, 'household', base);
      const page = await openAs(context, `/${locale}/studio`, 360, 780);
      const rights = await page
        .getByRole('navigation', { name: /Studio/i })
        .getByRole('link')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().right)));
      expect(rights).toHaveLength(5);
      expect(Math.max(...rights)).toBeLessThanOrEqual(360);
      await context.close();
    });
  }
});

test.describe('keyboard and motion preferences', () => {
  test.use({ locale: 'vi-VN' });

  test('menu button closes on Escape and returns focus to itself', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/vi');
    const summary = page.locator('header details > summary', { hasText: 'Menu' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('header details[open]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('header details[open]')).toHaveCount(0);
    await expect(summary).toBeFocused();
  });

  test('skip link is the first Tab stop and moves focus to the main content', async ({ page }) => {
    await page.goto('/vi/san-pham');
    await page.keyboard.press('Tab');
    const skip = page.locator('a[href="#main"]');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('prefers-reduced-motion: no CSS transition or looping animation survives', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/vi');
    const button = page.getByRole('link', { name: /Khám phá sản phẩm/ });
    const duration = await button.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration.split(',').every((d) => Number.parseFloat(d) < 0.001)).toBe(true);
    const looping = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY)
        .map((a) => a.id || a.constructor.name),
    );
    expect(looping).toEqual([]);
  });
});
