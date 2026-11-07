import { expect, test } from '@playwright/test';
import { DEMO } from '../demo/support/demo-session';

/**
 * GH#84 (FR-AUTH-07): the sign-in form runs Cloudflare Turnstile in test mode. The build must carry
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` (Cloudflare's always-pass key; CI sets it).
 * With demo credentials this signs in against the live API. Otherwise it intercepts the API response
 * and verifies that the browser forwards the solved CAPTCHA token without requiring Supabase.
 */
const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
test.skip(!siteKey, 'Needs a build with NEXT_PUBLIC_TURNSTILE_SITE_KEY (test key in CI).');

test.use({ locale: 'vi-VN' });

test('sign-in forwards the solved Turnstile token to the authentication API', async ({ page }) => {
  await page.goto('/vi/dang-nhap');
  // The challenge iframe sits in a closed shadow root, so check the widget's hidden field instead: the test
  // key solves itself and drops a dummy token there.
  const token = page.locator('input[name="cf-turnstile-response"]');
  await expect(token).toBeAttached({ timeout: 20_000 });
  await expect(token).toHaveValue(/\S/, { timeout: 20_000 });

  const password = process.env[DEMO.accounts.buyer.passwordEnv];
  const live = Boolean(process.env.E2E_BASE_URL && password);
  if (!live) {
    await page.route('**/api/v1/auth/sign-in', (route) =>
      route.fulfill({ status: 401, json: { code: 'AUTH_INVALID_CREDENTIALS' } }),
    );
  }
  await page
    .getByLabel('Tên đăng nhập hoặc email')
    .fill(live ? DEMO.accounts.buyer.email : 'buyer@vidu.vn');
  await page.getByLabel('Mật khẩu').fill(live ? (password ?? '') : 'mat-khau-thu-1');
  const solvedToken = await token.inputValue();
  const submitted = page.waitForRequest('**/api/v1/auth/sign-in');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  expect((await submitted).postDataJSON()).toMatchObject({ captchaToken: solvedToken });

  if (live) {
    await expect(page).not.toHaveURL(/dang-nhap/, { timeout: 15_000 });
    return;
  }
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toBeVisible();
  await expect(alert).not.toContainText('Tôi không phải robot');
});
