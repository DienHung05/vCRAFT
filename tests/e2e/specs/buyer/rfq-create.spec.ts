import { expect, type Page, test } from '@playwright/test';
import { demoSkipReason, loginContext } from '../demo/support/demo-session';

/**
 * Core flow: a Buyer fills the quotation request form at `/vi/yeu-cau-bao-gia/moi`, submits it and lands on
 * the request detail page with the "sent" status; the request then shows up in the buyer's list.
 *
 * Needs a build wired to real Supabase Auth and the API (`E2E_BASE_URL`) plus the demo account passwords
 * (`DEMO_*_PASSWORD`); the plain CI e2e job has no auth provider, so it skips there (like the other signed-in
 * specs). Each run creates its own request with a timestamped title and never touches seeded requests, so it is
 * safe next to the other specs and needs no DB reset.
 */
const skipReason = demoSkipReason();
test.skip(skipReason !== undefined, skipReason ?? '');

test.use({ locale: 'vi-VN' });

/** A calendar day `offset` days from now, as the form's Vietnam-time date input expects (`YYYY-MM-DD`). */
const vietnamDay = (offset: number) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

/** The step that the request journey stepper marks as `aria-current="step"`. */
const currentJourneyStep = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Tiến trình của yêu cầu báo giá' })
    .locator('[aria-current="step"]');

test('buyer creates and submits a quotation request, then sees it as sent', async ({
  page,
  context,
}) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  await loginContext(context, 'buyer', baseUrl);
  const title = `E2E yêu cầu báo giá ${Date.now()}`;

  await page.goto('/vi/yeu-cau-bao-gia/moi');
  await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu báo giá mới' })).toBeVisible();

  await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
  // The first real option; the placeholder option has an empty value.
  await page.getByLabel('Danh mục', { exact: true }).selectOption({ index: 1 });
  await page
    .getByLabel('Mô tả', { exact: true })
    .fill('Bộ ấm chén men lam cho quán trà, kiểm thử E2E.');
  await page.getByLabel('Số lượng', { exact: true }).fill('12');
  await page.getByLabel('Đơn vị', { exact: true }).fill('bộ');
  await page.getByLabel('Hạn chào giá', { exact: true }).fill(vietnamDay(5));
  await page.getByLabel('Ngày cần hàng', { exact: true }).fill(vietnamDay(20));
  await page.getByLabel('Nơi giao hàng', { exact: true }).fill('12 Hàng Bài, Hoàn Kiếm, Hà Nội');
  // "Nhờ Ban quản lý làng điều phối" is on by default, so no household has to be picked.
  await page.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }).check();

  await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();

  // The form saves the draft, submits it and routes to the detail page of the new request.
  await expect(page).toHaveURL(/\/vi\/yeu-cau-bao-gia\/(?!moi$)[^/?#]+$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(currentJourneyStep(page)).toContainText('Đã gửi');

  // The same request is listed for the buyer.
  await page.goto('/vi/yeu-cau-bao-gia');
  await expect(page.getByText(title).first()).toBeVisible();
});

test('buyer sees what is missing when the form is submitted empty', async ({ page, context }) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  await loginContext(context, 'buyer', baseUrl);
  await page.goto('/vi/yeu-cau-bao-gia/moi');
  await page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  await expect(page.getByText('Hãy nhập tiêu đề.')).toBeVisible();
  await expect(page.getByText('Hãy chọn danh mục.')).toBeVisible();
  await expect(
    page.getByText('Hãy đồng ý với chính sách quyền riêng tư để gửi yêu cầu.'),
  ).toBeVisible();
  // Nothing was submitted: still on the form.
  await expect(page).toHaveURL(/\/vi\/yeu-cau-bao-gia\/moi$/);
});
