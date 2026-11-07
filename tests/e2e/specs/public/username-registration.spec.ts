import { expect, test } from '@playwright/test';

// Exercise the browser form against the public HTTP contract without sending verification emails.
test('registers a lowercase username and keeps email confirmation', async ({ page }) => {
  await page.route('**/api/v1/auth/username-availability?**', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.route('**/api/v1/auth/sign-up', (route) => route.fulfill({ json: { ok: true } }));
  await page.goto('/en/register');
  await page.getByLabel('Username', { exact: true }).fill('New.Potter');
  await expect(page.getByText('This username is available.')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('new.potter@example.com');
  await page.getByLabel('Password', { exact: true }).fill('PotteryTest123');
  await page.getByRole('checkbox').check();
  const submitted = page.waitForRequest('**/api/v1/auth/sign-up');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({
    username: 'new.potter',
    email: 'new.potter@example.com',
  });
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
});

test('rejects reserved usernames before submitting registration', async ({ page }) => {
  await page.goto('/en/register');
  await page.getByLabel('Username', { exact: true }).fill('ADMIN');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(
    page.getByText('This username is reserved for system accounts. Choose another.'),
  ).toBeVisible();
});
