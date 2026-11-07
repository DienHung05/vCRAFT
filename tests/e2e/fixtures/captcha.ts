import { expect, type Page } from '@playwright/test';

/** CI builds enable Turnstile; wait for its test challenge before submitting an auth form. */
export async function waitForCaptcha(page: Page): Promise<void> {
  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()) return;
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/\S/, {
    timeout: 20_000,
  });
}
