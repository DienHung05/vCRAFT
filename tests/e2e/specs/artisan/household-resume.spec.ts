import { expect, test } from '@playwright/test';

/**
 * GH#180: an account that started household registration (`household_intent` in its Supabase metadata)
 * but never submitted the household info is still a Buyer. Signing in again from `/dang-nhap` must send
 * it back to the wizard, and the account menu must offer to finish the registration.
 *
 * Needs a build with real Supabase Auth and API (`E2E_BASE_URL`) and such an account:
 * `E2E_HOUSEHOLD_INTENT_EMAIL` / `E2E_HOUSEHOLD_INTENT_PASSWORD`. Without them it is skipped, like the
 * other sign-in specs, so plain CI stays green.
 */
const email = process.env.E2E_HOUSEHOLD_INTENT_EMAIL;
const password = process.env.E2E_HOUSEHOLD_INTENT_PASSWORD;
test.skip(
  !process.env.E2E_BASE_URL || !email || !password,
  'Needs E2E_BASE_URL (build with Supabase Auth + API) and E2E_HOUSEHOLD_INTENT_EMAIL/PASSWORD.',
);

test.use({ locale: 'vi-VN' });

test('unfinished household registration: sign in again → wizard household step and menu prompt', async ({
  page,
}) => {
  await page.goto('/vi/dang-nhap');
  await page.getByLabel('Email').fill(email ?? '');
  await page.getByLabel('Mật khẩu').fill(password ?? '');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  await expect(page).toHaveURL(/\/vi\/dang-ky-nghe-nhan$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { level: 2, name: 'Thông tin hộ' })).toBeVisible();

  await page.locator('summary').filter({ hasText: 'Tài khoản của bạn' }).click();
  await expect(page.getByRole('link', { name: 'Hoàn tất đăng ký hộ làng nghề' })).toBeVisible();
});
