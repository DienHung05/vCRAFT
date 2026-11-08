import { expect, test } from '@playwright/test';
import { DEMO } from '../demo/support/demo-session';

/**
 * GH#27 (FR-AUTH-04, FR-AUTH-09): đăng nhập Buyer demo qua form thật, không chèn cookie.
 * Chạy với bản có Supabase Auth và API thật: đặt `E2E_BASE_URL` (qua Caddy, vd. http://localhost:8080)
 * và `DEMO_BUYER_PASSWORD` (đọc từ .env gốc). Thiếu một trong hai thì bỏ qua, không làm CI thường đỏ.
 */
const password = process.env[DEMO.accounts.buyer.passwordEnv];
test.skip(
  !process.env.E2E_BASE_URL || !password,
  'Cần E2E_BASE_URL (bản có Supabase Auth + API) và DEMO_BUYER_PASSWORD.',
);

test.use({ locale: 'vi-VN' });

/**
 * Click-to-URL budget after submitting the sign-in form. It covers the Supabase round trip, the 520 ms seal
 * stamp that holds the navigation and the destination's server render (1 to 2.6 s). A real browser prerenders the
 * destination during the stamp, but Chrome turns prerendering off while DevTools is attached, which includes
 * Playwright, so here the three add up (about 3 to 5.5 s through Caddy) and the default 5 s was too tight.
 */
const SIGN_IN_NAVIGATION = { timeout: 15_000 };

test.describe('Đăng nhập, phiên và phân quyền khu vực', () => {
  test('khách vào khu Buyer → đăng nhập bằng form → quay lại đúng trang → đăng xuất', async ({
    page,
  }) => {
    await page.goto('/vi/yeu-cau-bao-gia');
    await expect(page).toHaveURL(/\/vi\/dang-nhap\?next=%2Fvi%2Fyeu-cau-bao-gia/);
    await expect(page.getByText('Bạn cần đăng nhập để vào trang này.')).toBeVisible();

    await page.getByLabel('Tên đăng nhập hoặc email').fill('buyer');
    await page.getByLabel('Mật khẩu').fill(password ?? '');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(/\/vi\/yeu-cau-bao-gia$/, SIGN_IN_NAVIGATION);
    await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu báo giá' })).toBeVisible();

    // Header: email, vai trò theo CSDL vCraft và nút đăng xuất.
    // The summary has no aria-label: its accessible name is its content, "Tài khoản của bạn: <email>" (the
    // email is visible text, WCAG 2.5.3), so find it by that text instead of an attribute.
    await page.locator('summary').filter({ hasText: 'Tài khoản của bạn' }).click();
    await expect(page.getByText(DEMO.accounts.buyer.email).first()).toBeVisible();
    await expect(page.getByText('Khách', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
    await page.goto('/vi/yeu-cau-bao-gia');
    await expect(page).toHaveURL(/\/vi\/dang-nhap/);
  });

  test('Buyer vào khu Admin nhận trang 403, không phải trang trống', async ({ page }) => {
    await page.goto('/vi/dang-nhap');
    await page.getByLabel('Tên đăng nhập hoặc email').fill('buyer');
    await page.getByLabel('Mật khẩu').fill(password ?? '');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).not.toHaveURL(/dang-nhap/, SIGN_IN_NAVIGATION);

    const response = await page.goto('/vi/admin');
    expect(response?.status()).toBe(403);
    await expect(
      page.getByRole('heading', { name: 'Bạn chưa có quyền vào trang này' }),
    ).toBeVisible();
  });

  test('sai mật khẩu: thông báo cụ thể và giữ nguyên email đã nhập', async ({ page }) => {
    await page.goto('/vi/dang-nhap');
    await page.getByLabel('Tên đăng nhập hoặc email').fill('buyer');
    await page.getByLabel('Mật khẩu').fill('mat-khau-sai-12345');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.locator('form [role="alert"]')).toContainText(
      'Tên đăng nhập, email hoặc mật khẩu chưa đúng',
    );
    await expect(page.getByLabel('Tên đăng nhập hoặc email')).toHaveValue('buyer');
  });
});
