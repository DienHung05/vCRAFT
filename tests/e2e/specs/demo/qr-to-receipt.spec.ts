import { type BrowserContext, devices, expect, type Page, test } from '@playwright/test';
import { DEMO, demoSkipReason, loginContext } from './support/demo-session';

/**
 * Kịch bản demo một mạch "QR → biên nhận" trên bản đã triển khai (vCRAFT-83g, GH#14).
 * Ba hồ sơ đăng nhập sẵn: Buyer (máy tính), Hộ (điện thoại), Admin (máy tính).
 *
 * Chạy:  E2E_BASE_URL=https://<host> ... pnpm demo:e2e   (xem docs/demo/README.md)
 * Dữ liệu: PHÁ dữ liệu đóng băng (duyệt hộ, chốt chào giá...). Chạy `pnpm demo:reset` TRƯỚC mỗi lần chạy.
 * Bỏ qua tự động khi thiếu E2E_BASE_URL hoặc thông tin đăng nhập, nên CI không có bản triển khai vẫn xanh.
 *
 * Mọi bước đều thao tác qua giao diện (duyệt hộ ở /admin/duyet-ho, xuất bản trong Studio); `callApi`
 * (support/demo-session.ts) chỉ còn dành cho bước nào thật sự chưa có màn hình.
 *
 * Every irreversible UI action (accept a quotation, start production, confirm receipt) opens a native
 * `<dialog>` (`ConfirmDialog`). A closed `<dialog>` is hidden from the accessibility tree, so
 * `getByRole('dialog')` only matches the open one; confirm inside it so the dialog's own button, which
 * shares its label with the page button, is never confused with the page button.
 */
const skipReason = demoSkipReason();

/** The step that the request journey stepper (`rfq.stepperLabel`) currently marks as `aria-current="step"`. */
const currentJourneyStep = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Tiến trình của yêu cầu báo giá' })
    .locator('[aria-current="step"]');
test.skip(skipReason !== undefined, skipReason ?? '');

test.describe.configure({ mode: 'serial' });

test.describe('Demo: QR → biên nhận', () => {
  let baseUrl: string;
  let buyerCtx: BrowserContext;
  let phoneCtx: BrowserContext;
  let adminCtx: BrowserContext;
  let buyerPage: Page;
  let phonePage: Page;
  let adminPage: Page;

  test.beforeAll(async ({ browser }) => {
    baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
    const common = { baseURL: baseUrl, locale: 'vi-VN' } as const;
    buyerCtx = await browser.newContext({ ...devices['Desktop Chrome'], ...common });
    phoneCtx = await browser.newContext({ ...devices['Pixel 7'], ...common });
    adminCtx = await browser.newContext({ ...devices['Desktop Chrome'], ...common });
    await loginContext(buyerCtx, 'buyer', baseUrl);
    await loginContext(phoneCtx, 'household', baseUrl);
    await loginContext(adminCtx, 'admin', baseUrl);
    [buyerPage, phonePage, adminPage] = await Promise.all([
      buyerCtx.newPage(),
      phoneCtx.newPage(),
      adminCtx.newPage(),
    ]);
  });

  test.afterAll(async () => {
    await Promise.all([buyerCtx?.close(), phoneCtx?.close(), adminCtx?.close()]);
  });

  test('1. Quét QR trên chiếc cốc → trang truy xuất', async () => {
    const response = await phonePage.goto(`/q/${DEMO.qrTraceCode}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(phonePage).toHaveURL(new RegExp(`/vi/truy-xuat/${DEMO.qrTraceCode}$`));
    await expect(phonePage.locator('main')).toBeVisible();
  });

  test('2. Admin duyệt hộ chờ duyệt (UI)', async () => {
    await adminPage.goto('/vi/admin/duyet-ho');
    await expect(adminPage.getByRole('heading', { level: 1, name: 'Duyệt hộ' })).toBeVisible();
    // household-queue.tsx: the queue defaults to PENDING_REVIEW; each row is a link to the review page.
    await adminPage
      .getByTestId('household-queue')
      .getByRole('link', { name: /Gốm Bảo Châu/ })
      .click();
    await expect(adminPage.getByRole('heading', { level: 1, name: 'Gốm Bảo Châu' })).toBeVisible();
    // household-review.tsx: the approve button opens a ConfirmDialog whose confirm button has the same label.
    await adminPage.getByRole('button', { name: 'Duyệt', exact: true }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Duyệt hộ này?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(adminPage.getByText('Đã được duyệt, đang trưng bày công khai')).toBeVisible();
  });

  test('3. Hộ (điện thoại) xuất bản một sản phẩm nháp (UI)', async () => {
    await phonePage.goto('/vi/studio/san-pham');
    await expect(phonePage.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
    // product-list.tsx: the status filter is a radio group; keep only the drafts.
    await phonePage.getByRole('radio', { name: 'Nháp', exact: true }).check({ force: true });
    const drafts = phonePage.getByTestId('studio-products').getByRole('link');
    expect(await drafts.count(), 'hộ phải còn sản phẩm nháp; chạy pnpm demo:reset').toBeGreaterThan(
      0,
    );
    await drafts.first().click();
    // product-editor.tsx (PublishSection): the publish button opens a ConfirmDialog with the same label.
    await phonePage.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    const dialog = phonePage.getByRole('dialog', { name: 'Xuất bản sản phẩm này?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Xuất bản', exact: true }).click();
    await expect(dialog).toBeHidden();
    // A published product offers "Lưu trữ" instead of "Xuất bản".
    await expect(phonePage.getByRole('button', { name: 'Lưu trữ', exact: true })).toBeVisible();
    await expect(phonePage.getByRole('button', { name: 'Xuất bản', exact: true })).toHaveCount(0);
  });

  test('4. Khám phá xưởng: trang hộ công khai mở được', async () => {
    const response = await phonePage.goto(`/vi/nghe-nhan/${DEMO.householdSlug}`);
    expect(response?.status()).toBeLessThan(400);
    await expect(phonePage.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('5. Tin tức: trang tin có ≥ 15 bài', async () => {
    const response = await buyerPage.goto('/vi/tin-tuc');
    expect(response?.status()).toBeLessThan(400);
    await expect(
      buyerPage.getByRole('heading', { level: 1, name: 'Tin tức làng nghề' }),
    ).toBeVisible();
    const items = buyerPage.getByRole('list', { name: 'Danh sách tin tức' }).getByRole('listitem');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThanOrEqual(15);
  });

  test('6. Buyer xem các chào giá rồi chốt (UI)', async () => {
    await buyerPage.goto(`/vi/yeu-cau-bao-gia/${DEMO.requests.biddingToAccept}`);
    await expect(buyerPage.getByRole('heading', { name: 'Chào giá nhận được' })).toBeVisible();
    await expect(buyerPage.getByText('Tổng cho bên mua').first()).toBeVisible();
    await expect(currentJourneyStep(buyerPage)).toContainText('Đang chào giá');

    // buyer-rfq-detail.tsx: the accept button on a quotation card opens a ConfirmDialog.
    await buyerPage
      .getByTestId('quotation-comparison')
      .getByRole('button', { name: 'Chốt chào giá này', exact: true })
      .first()
      .click();
    const dialog = buyerPage.getByRole('dialog', { name: 'Chốt chào giá này?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Chốt chào giá này', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(currentJourneyStep(buyerPage)).toContainText('Đã chốt');
  });

  test('7. Admin nhận điều phối yêu cầu nhờ BQL (UI)', async () => {
    await adminPage.goto(`/vi/admin/dieu-phoi/${DEMO.requests.sentOptIn}`);
    await adminPage.getByRole('button', { name: 'Nhận điều phối' }).click();
    await expect(adminPage.getByRole('button', { name: 'Nhận điều phối' })).toHaveCount(0);
  });

  test('8. Hộ (điện thoại) xác nhận phân bổ (UI)', async () => {
    await phonePage.goto(`/vi/studio/de-xuat-tham-gia/${DEMO.requests.acceptedConfirm}`);
    const card = phonePage.getByTestId('allocation-card');
    await expect(card.getByText('Chờ xác nhận', { exact: true })).toBeVisible();
    // Confirming has no dialog (only "Từ chối" does).
    await card.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(card.getByText('Đã xác nhận', { exact: true })).toBeVisible();
  });

  test('9. Admin bắt đầu sản xuất đơn đã được các hộ xác nhận (UI)', async () => {
    await adminPage.goto(`/vi/admin/dieu-phoi/${DEMO.requests.acceptedConfirm}`);
    // live-coordination.tsx: the page button opens a ConfirmDialog whose confirm button has the same label.
    await adminPage.getByRole('button', { name: 'Bắt đầu sản xuất', exact: true }).click();
    const dialog = adminPage.getByRole('dialog', { name: 'Bắt đầu sản xuất?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Bắt đầu sản xuất', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(adminPage.getByRole('button', { name: 'Bắt đầu sản xuất' })).toHaveCount(0);
    // The IN_PRODUCTION actions replace the ACCEPTED one.
    await expect(
      adminPage.getByRole('button', { name: 'Xác nhận đã nhận hàng', exact: true }),
    ).toBeVisible();
    await expect(adminPage.getByRole('button', { name: 'Hủy đơn', exact: true })).toBeVisible();
  });

  test('10. Hộ báo cáo tiến độ đến hết số lượng (UI)', async () => {
    await phonePage.goto(`/vi/studio/de-xuat-tham-gia/${DEMO.requests.inProduction}`);
    const card = phonePage.getByTestId('allocation-card');
    // Exact text: the history list repeats "<date> · 500 / 500" in a separate paragraph.
    await expect(card.getByText('350 / 500', { exact: true })).toBeVisible();
    await card.getByLabel('Số lượng đã xong').fill('500');
    await card.getByRole('button', { name: 'Báo cáo', exact: true }).click();
    await expect(card.getByText('500 / 500', { exact: true })).toBeVisible();
    // Exact text: the "Số lượng đã xong" label also contains "đã xong".
    await expect(card.getByText('Đã xong', { exact: true })).toBeVisible();
  });

  test('11. Buyer xác nhận đã nhận hàng → biên nhận (UI)', async () => {
    await buyerPage.goto(`/vi/yeu-cau-bao-gia/${DEMO.requests.inProduction}`);
    await expect(currentJourneyStep(buyerPage)).toContainText('Đang sản xuất');
    // buyer-rfq-detail.tsx: the receive button opens a ConfirmDialog with the same label on its confirm button.
    await buyerPage.getByRole('button', { name: 'Xác nhận đã nhận hàng', exact: true }).click();
    const dialog = buyerPage.getByRole('dialog', { name: 'Xác nhận đã nhận hàng?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Xác nhận đã nhận hàng', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(
      buyerPage.getByRole('button', { name: 'Xác nhận đã nhận hàng', exact: true }),
    ).toHaveCount(0);
    // The stepper lists "Đã giao" at all times, so check the current step, not the text.
    await expect(currentJourneyStep(buyerPage)).toContainText('Đã giao');
  });

  test('12. Buyer so sánh ba báo giá trực tiếp của ba hộ rồi chốt một (UI, GH#479)', async () => {
    await buyerPage.goto(`/vi/yeu-cau-bao-gia/${DEMO.requests.biddingDirect}`);
    await expect(buyerPage.getByRole('heading', { name: 'Chào giá nhận được' })).toBeVisible();
    const comparison = buyerPage.getByTestId('quotation-comparison');
    // Three households quote the whole quantity themselves: name, rating, unit price, completion date, note, one accept each.
    for (const household of ['Gốm Minh Hải', 'Gốm Kim Liên', 'Gốm Ngọc Diệp'])
      await expect(comparison.getByText(household, { exact: true })).toBeVisible();
    await expect(comparison.getByText('Hộ báo giá riêng')).toHaveCount(3);
    await expect(comparison.getByText(/Hoàn thành/)).toHaveCount(3);
    await expect(comparison.getByText(/Ghi chú của hộ/)).toHaveCount(3);
    await expect(comparison.getByText('5,0/5 sao · 1 đánh giá')).toBeVisible();
    const accepts = comparison.getByRole('button', { name: 'Chốt chào giá này', exact: true });
    await expect(accepts).toHaveCount(3);

    // Accept the cheapest (Gốm Ngọc Diệp): the others become "Không được chọn" and the request "Đã chốt".
    await comparison
      .getByRole('listitem')
      .filter({ hasText: 'Gốm Ngọc Diệp' })
      .first()
      .getByRole('button', { name: 'Chốt chào giá này', exact: true })
      .click();
    const dialog = buyerPage.getByRole('dialog', { name: 'Chốt chào giá này?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Chốt chào giá này', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(currentJourneyStep(buyerPage)).toContainText('Đã chốt');
    await expect(comparison.getByText('Không được chọn')).toHaveCount(2);
    await expect(comparison.getByText('Đã chốt', { exact: true })).toHaveCount(1);
  });

  test('13. Hộ (điện thoại) gửi báo giá trực tiếp cho yêu cầu không qua điều phối (UI, GH#479)', async () => {
    await phonePage.goto(`/vi/studio/de-xuat-tham-gia/${DEMO.requests.sentDirect}`);
    await expect(
      phonePage.getByRole('heading', { level: 1, name: 'Bộ ấm chén men lam cho homestay' }),
    ).toBeVisible();
    // direct-quotation-form.tsx: the deadline is 30 days out and delivery 75, so a date 50 days out is inside the window.
    const finish = new Date(Date.now() + 50 * 86_400_000).toISOString().slice(0, 10);
    await phonePage.getByLabel('Đơn giá (VND)').fill('185000');
    await phonePage.getByLabel('Ngày hoàn thành').fill(finish);
    await phonePage.getByLabel('Ghi chú cho bên mua (không bắt buộc)').fill('Vẽ lam thủ công');
    await phonePage.getByRole('button', { name: 'Gửi báo giá', exact: true }).click();
    await expect(phonePage.getByText(/Báo giá đang chờ bên mua/)).toBeVisible();
    // The same form now revises or withdraws the quotation.
    await expect(
      phonePage.getByRole('button', { name: 'Cập nhật báo giá', exact: true }),
    ).toBeVisible();
    await expect(phonePage.getByRole('button', { name: 'Rút báo giá', exact: true })).toBeVisible();
  });
});
