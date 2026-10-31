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

test.describe('Đăng nhập, phiên và phân quyền khu vực', () => {
  test('khách vào khu Buyer → đăng nhập bằng form → quay lại đúng trang → đăng xuất', async ({
    page,
  }) => {
    await page.goto('/vi/yeu-cau-bao-gia');
    await expect(page).toHaveURL(/\/vi\/dang-nhap\?next=%2Fvi%2Fyeu-cau-bao-gia/);
    await expect(page.getByText('Bạn cần đăng nhập để vào trang này.')).toBeVisible();

    await page.getByLabel('Email').fill(DEMO.accounts.buyer.email);
    await page.getByLabel('Mật khẩu').fill(password ?? '');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL(/\/vi\/yeu-cau-bao-gia$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu báo giá' })).toBeVisible();

    // Header: email, vai trò theo CSDL vCraft và nút đăng xuất.
    await page.locator('summary[aria-label="Tài khoản của bạn"]').click();
    await expect(page.getByText(DEMO.accounts.buyer.email).first()).toBeVisible();
    await expect(page.getByText('Khách', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
    await page.goto('/vi/yeu-cau-bao-gia');
    await expect(page).toHaveURL(/\/vi\/dang-nhap/);
  });

  test('Buyer vào khu Admin nhận trang 403, không phải trang trống', async ({ page }) => {
    await page.goto('/vi/dang-nhap');
    await page.getByLabel('Email').fill(DEMO.accounts.buyer.email);
    await page.getByLabel('Mật khẩu').fill(password ?? '');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).not.toHaveURL(/dang-nhap/);

    const response = await page.goto('/vi/admin');
    expect(response?.status()).toBe(403);
    await expect(
      page.getByRole('heading', { name: 'Bạn chưa có quyền vào trang này' }),
    ).toBeVisible();
  });

  test('sai mật khẩu: thông báo cụ thể và giữ nguyên email đã nhập', async ({ page }) => {
    await page.goto('/vi/dang-nhap');
    await page.getByLabel('Email').fill(DEMO.accounts.buyer.email);
    await page.getByLabel('Mật khẩu').fill('mat-khau-sai-12345');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.locator('form [role="alert"]')).toContainText(
      'Email hoặc mật khẩu chưa đúng',
    );
    await expect(page.getByLabel('Email')).toHaveValue(DEMO.accounts.buyer.email);
  });
});
