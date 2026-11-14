import { expect, test } from '@playwright/test';

/** Mã truy xuất của sản phẩm mẫu có đủ 7 công đoạn và một mốc đính chính (dữ liệu minh họa của apps/web). */
const CODE = 'BT7K2QXM';

const LOCALES = [
  {
    name: 'vi',
    locale: 'vi-VN',
    product: '/vi/san-pham/binh-hut-loc-men-lam-bt7k2qxm',
    trace: `/vi/truy-xuat/${CODE}`,
    integrity: 'Nhật ký được giữ nguyên từ ngày ghi',
    notFound: 'Trang này chưa ra lò',
    unknownCode: 'Mã này không có trong vCraft',
  },
  {
    name: 'en',
    locale: 'en-US',
    product: '/en/products/binh-hut-loc-men-lam-bt7k2qxm',
    trace: `/en/trace/${CODE}`,
    integrity: "This journal hasn't been changed since it was written",
    notFound: "This page hasn't come out of the kiln",
    unknownCode: "This code isn't in vCraft",
  },
] as const;

for (const L of LOCALES) {
  test.describe(`QR → truy xuất (${L.name})`, () => {
    // `locale` đặt cả `Accept-Language`, là thứ route /q/<code> dùng để chọn ngôn ngữ.
    test.use({ locale: L.locale });

    test('trang sản phẩm → liên kết QR /q/<code> → trang truy xuất, chuỗi băm toàn vẹn', async ({
      page,
    }) => {
      await page.goto(L.product);
      await page.locator(`main a[href$="/${CODE}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${L.trace}$`));

      // Liên kết ngắn mà mã QR mã hóa. Origin do cấu hình deploy quyết định, nên chỉ lấy đường dẫn.
      const href = await page.locator(`a[href$="/q/${CODE}"]`).getAttribute('href');
      expect(href).toBeTruthy();
      const shortPath = new URL(href ?? '').pathname;
      expect(shortPath).toBe(`/q/${CODE}`);

      await page.goto(shortPath);
      await expect(page).toHaveURL(new RegExp(`${L.trace}$`));

      // Trạng thái toàn vẹn do trình duyệt tự tính bằng Web Crypto (FR-TRC-05).
      const panel = page.locator('[data-state]').filter({ hasText: L.integrity }).first();
      await expect(panel).toHaveAttribute('data-state', 'ok');
      await expect(panel.getByText(L.integrity).first()).toBeVisible();
      await expect(page.locator('[data-state="broken"]')).toHaveCount(0);
    });

    test('redirect 308 từ /q/<code> không đi qua tên miền khác', async ({ request }) => {
      const res = await request.get(`/q/${CODE}`, {
        maxRedirects: 0,
        headers: { 'accept-language': L.locale },
      });
      expect(res.status()).toBe(308);
      expect(res.headers().location).toBe(L.trace);
    });

    test('mã sai định dạng → 404, mã đúng định dạng nhưng không tồn tại → cảnh báo', async ({
      page,
    }) => {
      const malformed = await page.goto('/q/BAD0CODE');
      expect(malformed?.status()).toBe(404);
      await expect(page.getByRole('heading', { name: L.notFound })).toBeVisible();

      await page.goto('/q/ZZZZZZZZ');
      await expect(page.getByRole('heading', { name: L.unknownCode })).toBeVisible();
      await expect(page.locator('[data-state]')).toHaveCount(0);
    });

    test('mọi liên kết ở thanh điều hướng và chân trang đều mở được (không 404)', async ({
      page,
      request,
    }) => {
      await page.goto(L.product);
      const hrefs = await page
        .locator('header nav a[href], footer a[href]')
        .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute('href') ?? ''))]);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        if (!href.startsWith('/')) continue;
        const res = await request.get(href);
        expect(res.status(), href).toBeLessThan(400);
      }
    });
  });
}
