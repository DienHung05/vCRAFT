import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { DEMO } from './support/demo-session';

/**
 * Pre-exam (GH#14): các kiểm tra tự động trên trang công khai, không cần đăng nhập.
 * - WCAG AA (axe: wcag2a, wcag2aa, wcag21a, wcag21aa) không có vi phạm.
 * - Đáp ứng 360–1440 px: không cuộn ngang.
 * - Không nạp lại toàn trang khi đi qua thanh điều hướng.
 * - Đường QR đi được hoàn toàn bằng bàn phím.
 *
 * Chỉ chạy khi đặt DEMO_PREEXAM=1 (không làm CI thường đỏ vì trang đang phát triển).
 * Chạy:  DEMO_PREEXAM=1 pnpm demo:e2e:preexam   (E2E_BASE_URL để trỏ tới bản triển khai; không đặt thì dùng web local)
 */
test.skip(!process.env.DEMO_PREEXAM, 'Đặt DEMO_PREEXAM=1 để chạy các kiểm tra pre-exam.');

const PAGES = [
  '/vi',
  '/vi/nghe-nhan',
  `/vi/nghe-nhan/${DEMO.householdSlug}`,
  '/vi/san-pham',
  `/vi/truy-xuat/${DEMO.qrTraceCode}`,
  // GH#38: the rest of the public pages and the auth screens.
  '/en',
  '/vi/ban-do',
  '/vi/tin-tuc',
  '/vi/ghi-nhan-anh',
  '/vi/chinh-sach-quyen-rieng-tu',
  '/vi/dang-nhap',
  '/vi/dang-ky',
  '/vi/dang-ky-nghe-nhan',
  '/vi/quen-mat-khau',
  '/vi/khong-co-trang-nao',
] as const;
const WIDTHS = [360, 768, 1024, 1280, 1440, 1536] as const;

test.use({ locale: 'vi-VN' });

for (const path of PAGES) {
  test.describe(path, () => {
    test('WCAG AA: axe không báo vi phạm', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} nút (${v.help})`)).toEqual(
        [],
      );
    });

    for (const width of WIDTHS) {
      test(`đáp ứng ${width}px: không cuộn ngang`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState('load');
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `scrollWidth vượt clientWidth ${overflow}px`).toBeLessThanOrEqual(0);
      });
    }
  });
}

test('không nạp lại toàn trang khi đi qua thanh điều hướng', async ({ page }) => {
  await page.goto('/vi');
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });
  const hrefs = await page
    .locator('header nav a[href^="/vi"]')
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') ?? ''))]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 5)) {
    await page.locator(`header nav a[href="${href}"]`).first().click();
    await page.waitForURL(`**${href}`);
    const survived = await page.evaluate(
      () => (window as unknown as { __noReload?: boolean }).__noReload === true,
    );
    expect(survived, `${href} gây nạp lại toàn trang`).toBe(true);
  }
});

test('đường QR đi được bằng bàn phím: có vòng focus nhìn thấy và kích hoạt được liên kết', async ({
  page,
}) => {
  await page.goto(`/q/${DEMO.qrTraceCode}`);
  await expect(page).toHaveURL(new RegExp(`/vi/truy-xuat/${DEMO.qrTraceCode}$`));

  const seen = new Set<string>();
  const withoutRing: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const ring =
        (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none';
      const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
      return { id: `${el.tagName}:${label}:${el.getAttribute('href') ?? ''}`, ring };
    });
    if (!info) continue;
    seen.add(info.id);
    if (!info.ring) withoutRing.push(info.id);
  }
  expect(seen.size, 'Tab phải đi qua ít nhất 5 phần tử khác nhau').toBeGreaterThanOrEqual(5);
  expect(withoutRing, 'phần tử nhận focus mà không có vòng focus').toEqual([]);

  // Kích hoạt liên kết "Về trang chủ" chỉ bằng bàn phím
  const home = page.getByRole('link', { name: /Về trang chủ/ }).first();
  await home.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/vi\/?$/);
});
