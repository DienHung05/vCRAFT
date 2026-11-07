import { expect, test } from '@playwright/test';

// Failed sign-ins never expose the resolved email or whether the username exists.
test('shows the same generic error for wrong usernames and passwords', async ({ page }) => {
  await page.route('**/api/v1/auth/sign-in', (route) =>
    route.fulfill({
      status: 401,
      json: { code: 'AUTH_INVALID_CREDENTIALS' },
    }),
  );
  await page.goto('/en/login');
  const identifier = page.getByLabel('Username or email');
  await identifier.fill('missing.potter');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const alert = page.locator('form [role="alert"]');
  await expect(alert).toContainText('The username, email or password is not right.');
  await expect(identifier).toHaveValue('missing.potter');
  const firstMessage = await alert.textContent();
  await identifier.fill('buyer');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(alert).toHaveText(firstMessage ?? '');
  await expect(identifier).toHaveValue('buyer');
});
