import { expect, test } from '@playwright/test';

/**
 * Issue #8 / vCRAFT-9hg.6: biến thể A (trang hộ, đọc liền một mạch) và biến thể C (trang QR, mở bằng
 * ấn và nhật ký mới nhất trước) cùng hiện trên dữ liệu minh họa.
 */
test.describe('Triển lãm công khai', () => {
  test.use({ locale: 'vi-VN' });

  test('biến thể A: hộ → người làm → món đồ → bằng chứng → ghé thăm → đặt hàng số lượng', async ({
    page,
  }) => {
    await page.goto('/vi/nghe-nhan/gom-minh-hai');
    const headings = await page.locator('article h2').allTextContents();
    const order = [
      'Câu chuyện của hộ',
      'Những người làm',
      'Sản phẩm của hộ',
      'Bằng chứng quá trình làm',
      'Ghé thăm',
      'Đặt hàng số lượng',
    ].map((h) => headings.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    await expect(page.getByText(/do ban điều hành hộ Gốm Minh Hải đăng/)).toBeVisible();
    await expect(page.getByTestId('showrooms')).toContainText('Gốm Minh Hải');
    await expect(page.getByRole('figure', { name: 'Bản đồ làng' })).toBeVisible();
    await expect(page.getByTestId('place-list').getByRole('listitem').first()).toBeVisible();
  });

  test('biến thể C: trang QR mở bằng ấn, nhật ký mới nhất trước, có liên kết về trang chủ', async ({
    page,
  }) => {
    await page.goto('/vi/truy-xuat/BT7K2QXM');
    await expect(page.locator('[data-state="ok"]')).toBeVisible();
    await expect(page.getByText(/^Toàn vẹn nhật ký:/)).toBeVisible();
    const logs = await page.locator('li[id^="log-"]').evaluateAll((els) => els.map((e) => e.id));
    // Dữ liệu seed có 7 mốc, mốc mới nhất đứng đầu; luồng đính chính nằm ở test tích hợp nhật ký.
    expect(logs[0]).toBe('log-7');
    await expect(page.getByRole('link', { name: 'Về trang chủ triển lãm' })).toBeVisible();
    await expect(page.getByTestId('place-list')).toBeVisible();
  });
});
