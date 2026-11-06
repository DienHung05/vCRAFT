import { expect, test } from '@playwright/test';
import { DEMO } from '../demo/support/demo-session';

/**
 * GH#84 (FR-AUTH-07): the sign-in form runs Cloudflare Turnstile in test mode. The build must carry
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare's always-pass key; CI sets it).
 * Without Supabase Auth the form stops at "not configured", which still proves it got past the CAPTCHA
 * gate; with `E2E_BASE_URL` and the demo password the buyer actually signs in.
 */
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
test.skip(!siteKey, 'Needs a build with NEXT_PUBLIC_TURNSTILE_SITE_KEY (test key in CI).');

test.use({ locale: 'vi-VN' });

test('sign-in passes the Turnstile check in test mode before calling Supabase', async ({
  page,
}) => {
  await page.goto('/vi/dang-nhap');
  // The challenge iframe sits in a closed shadow root, so check the widget's hidden field instead: the test
  // key solves itself and drops a dummy token there.
  const token = page.locator('input[name="cf-turnstile-response"]');
  await expect(token).toBeAttached({ timeout: 20_000 });
  await expect(token).toHaveValue(/\S/, { timeout: 20_000 });

  const password = process.env[DEMO.accounts.buyer.passwordEnv];
  const live = Boolean(process.env.E2E_BASE_URL && password);
  await page.getByLabel('Email').fill(live ? DEMO.accounts.buyer.email : 'buyer@vidu.vn');
  await page.getByLabel('Mật khẩu').fill(live ? (password ?? '') : 'mat-khau-thu-1');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();

  if (live) {
    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 15_000 });
    return;
  }
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('Tôi không phải robot');
});
