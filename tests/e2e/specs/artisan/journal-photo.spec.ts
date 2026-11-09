import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { callApi, demoSkipReason, loginContext } from '../demo/support/demo-session';

/**
 * Core flow: a household adds a production journal entry with a photo to one of its own products and sees
 * the new entry in the list (`/vi/studio/san-pham/<id>/nhat-ky`).
 *
 * Media processing (resize, WebP variants) is done by the worker, which the CI e2e job does not start, so the
 * spec only asserts that the upload is accepted (`POST /api/v1/media` answers 2xx; 202 means "queued") and that
 * the entry is saved with one photo slot, which shows either the processed picture or the "processing"
 * placeholder. It never waits for the photo to become ready.
 *
 * Needs a build wired to real Supabase Auth and the API (`E2E_BASE_URL`) plus the demo passwords, so it skips in
 * the plain CI e2e job. The entry note is timestamped and nothing seeded is changed, so reruns are safe; a draft
 * product is preferred because a published product's journal is append-only and asks for one more confirmation.
 */
const skipReason = demoSkipReason();
test.skip(skipReason !== undefined, skipReason ?? '');

test.use({ locale: 'vi-VN' });

const PHOTO = resolve(__dirname, '../../fixtures/journal-photo.jpg');

test('household adds a journal entry with a photo and sees it listed', async ({
  page,
  context,
}) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  const session = await loginContext(context, 'household', baseUrl);

  const mine = await callApi<{
    products: Array<{ id: string; name: string; status: string }>;
  }>(session, baseUrl, 'GET', '/me/household');
  expect(mine.status).toBe(200);
  const product =
    mine.body.products.find((p) => p.status === 'DRAFT') ??
    mine.body.products.find((p) => p.status === 'PUBLISHED');
  expect(product, 'the demo household must own a draft or published product').toBeTruthy();
  const sealed = product?.status !== 'DRAFT';

  const note = `E2E journal entry ${Date.now()}`;
  await page.goto(`/vi/studio/san-pham/${product?.id}/nhat-ky`);
  await expect(page.getByRole('heading', { level: 1, name: /^Nhật ký:/ })).toBeVisible();

  await page.getByRole('button', { name: 'Thêm mốc', exact: true }).first().click();
  const form = page.getByTestId('journal-form');
  await expect(form).toBeVisible();

  await form.locator('input[type="file"]').setInputFiles(PHOTO);
  await form.getByLabel('Ghi chú', { exact: true }).fill(note);

  const upload = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/media') && response.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Lưu mốc', exact: true }).click();
  if (sealed) {
    // A published product's journal is append-only: the save asks for one more confirmation.
    const dialog = page.getByRole('dialog', { name: 'Ghi mốc vào nhật ký đã xuất bản?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Lưu mốc', exact: true }).click();
  }
  // 200 when the worker already processed it, 202 when it is queued; both mean the upload was accepted.
  expect([200, 201, 202]).toContain((await upload).status());

  // The form closes after the save and the new entry is listed with its photo slot.
  await expect(page.getByTestId('journal-form')).toBeHidden({ timeout: 30_000 });
  const entry = page.getByTestId('journal-entries').getByRole('listitem').filter({ hasText: note });
  await expect(entry).toBeVisible();
  await expect(entry.getByTestId('entry-photos').getByRole('listitem')).toHaveCount(1);
});

test('household cannot save a journal entry without a photo', async ({ page, context }) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  const session = await loginContext(context, 'household', baseUrl);
  const mine = await callApi<{ products: Array<{ id: string }> }>(
    session,
    baseUrl,
    'GET',
    '/me/household',
  );
  const product = mine.body.products[0];
  expect(product, 'the demo household must own a product').toBeTruthy();

  await page.goto(`/vi/studio/san-pham/${product?.id}/nhat-ky`);
  await page.getByRole('button', { name: 'Thêm mốc', exact: true }).first().click();
  const form = page.getByTestId('journal-form');
  await form.getByLabel('Ghi chú', { exact: true }).fill(`E2E no photo ${Date.now()}`);
  await form.getByRole('button', { name: 'Lưu mốc', exact: true }).click();
  await expect(
    form.getByText('Hãy thêm ít nhất một ảnh làm bằng chứng cho công đoạn này.'),
  ).toBeVisible();
});
