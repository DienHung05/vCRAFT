import { type BrowserContext, devices, expect, type Page, test } from '@playwright/test';
import {
  callApi,
  DEMO,
  demoSkipReason,
  loginContext,
  type SupabaseSession,
} from './support/demo-session';

/**
 * Kịch bản demo một mạch "QR → biên nhận" trên bản đã triển khai (vCRAFT-83g, GH#14).
 * Ba hồ sơ đăng nhập sẵn: Buyer (máy tính), Hộ (điện thoại), Admin (máy tính).
 *
 * Chạy:  E2E_BASE_URL=https://<host> ... pnpm demo:e2e   (xem docs/demo/README.md)
 * Dữ liệu: PHÁ dữ liệu đóng băng (duyệt hộ, chốt chào giá...). Chạy `pnpm demo:reset` TRƯỚC mỗi lần chạy.
 * Bỏ qua tự động khi thiếu E2E_BASE_URL hoặc thông tin đăng nhập, nên CI không có bản triển khai vẫn xanh.
 *
 * Bước chưa có màn hình ở web hiện tại (duyệt hộ của Admin, xuất bản của hộ, nút chốt chào giá của Buyer, tin tức)
 * gọi thẳng API bằng đúng phiên đã đăng nhập, ghi chú ngay tại bước; khi màn hình có, đổi sang thao tác UI.
 */
const skipReason = demoSkipReason();
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
  let buyerSession: SupabaseSession;
  let householdSession: SupabaseSession;
  let adminSession: SupabaseSession;

  test.beforeAll(async ({ browser }) => {
    baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
    const common = { baseURL: baseUrl, locale: 'vi-VN' } as const;
    buyerCtx = await browser.newContext({ ...devices['Desktop Chrome'], ...common });
    phoneCtx = await browser.newContext({ ...devices['Pixel 7'], ...common });
    adminCtx = await browser.newContext({ ...devices['Desktop Chrome'], ...common });
    buyerSession = await loginContext(buyerCtx, 'buyer', baseUrl);
    householdSession = await loginContext(phoneCtx, 'household', baseUrl);
    adminSession = await loginContext(adminCtx, 'admin', baseUrl);
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

  test('2. Admin duyệt hộ chờ duyệt (API: chưa có màn duyệt hộ)', async () => {
    const list = await callApi<Array<{ id: string; version: number }>>(
      adminSession,
      baseUrl,
      'GET',
      '/admin/households?status=PENDING_REVIEW',
    );
    expect(list.status).toBe(200);
    const pending = (Array.isArray(list.body) ? list.body : []).find(
      (household) => household.id === DEMO.pendingHouseholdId,
    );
    expect(pending, 'hộ chờ duyệt phải còn trong hàng đợi; chạy pnpm demo:reset').toBeTruthy();
    const approved = await callApi<{ status: string }>(
      adminSession,
      baseUrl,
      'POST',
      `/admin/households/${DEMO.pendingHouseholdId}/approve`,
      { version: pending?.version ?? 0 },
    );
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
  });

  test('3. Hộ (điện thoại) xuất bản một sản phẩm nháp (API: chưa có màn xuất bản)', async () => {
    const mine = await callApi<{
      products: Array<{ id: string; status: string; version: number }>;
    }>(householdSession, baseUrl, 'GET', '/me/household');
    expect(mine.status).toBe(200);
    const draft = mine.body.products.find((product) => product.status === 'DRAFT');
    expect(draft, 'hộ phải còn sản phẩm nháp; chạy pnpm demo:reset').toBeTruthy();
    const published = await callApi<{ status: string }>(
      householdSession,
      baseUrl,
      'POST',
      `/products/${draft?.id}/publish`,
      { version: draft?.version ?? 0 },
    );
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('PUBLISHED');
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

  test('6. Buyer xem các chào giá rồi chốt (UI xem, API chốt: chưa có nút chốt)', async () => {
    await buyerPage.goto(`/vi/yeu-cau-bao-gia/${DEMO.requests.biddingToAccept}`);
    await expect(buyerPage.getByRole('heading', { name: 'Chào giá nhận được' })).toBeVisible();
    await expect(buyerPage.getByText('Tổng cho bên mua').first()).toBeVisible();

    const quotations = await callApi<Array<{ id: string; status: string }>>(
      buyerSession,
      baseUrl,
      'GET',
      `/rfqs/${DEMO.requests.biddingToAccept}/quotations`,
    );
    const submitted = quotations.body.find((quotation) => quotation.status === 'SUBMITTED');
    expect(submitted).toBeTruthy();
    const request = await callApi(
      buyerSession,
      baseUrl,
      'GET',
      `/rfqs/${DEMO.requests.biddingToAccept}`,
    );
    const version = Number(request.etag?.replaceAll('"', ''));
    const accepted = await callApi<{ status: string }>(
      buyerSession,
      baseUrl,
      'POST',
      `/rfqs/${DEMO.requests.biddingToAccept}/accept`,
      { version, body: { quotationId: submitted?.id } },
    );
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    await buyerPage.reload();
    await expect(buyerPage.getByText('Đã chốt').first()).toBeVisible();
  });

  test('7. Admin nhận điều phối yêu cầu nhờ BQL (UI)', async () => {
    await adminPage.goto(`/vi/admin/dieu-phoi/${DEMO.requests.sentOptIn}`);
    await adminPage.getByRole('button', { name: 'Nhận điều phối' }).click();
    await expect(adminPage.getByRole('button', { name: 'Nhận điều phối' })).toHaveCount(0);
  });

  test('8. Hộ (điện thoại) xác nhận phân bổ (UI)', async () => {
    await phonePage.goto(`/vi/studio/de-xuat-tham-gia/${DEMO.requests.acceptedConfirm}`);
    await expect(phonePage.getByText('Chờ xác nhận').first()).toBeVisible();
    await phonePage.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(phonePage.getByText('Đã xác nhận').first()).toBeVisible();
  });

  test('9. Admin bắt đầu sản xuất đơn đã được các hộ xác nhận (UI)', async () => {
    await adminPage.goto(`/vi/admin/dieu-phoi/${DEMO.requests.acceptedConfirm}`);
    await adminPage.getByRole('button', { name: 'Bắt đầu sản xuất' }).click();
    await expect(adminPage.getByRole('button', { name: 'Bắt đầu sản xuất' })).toHaveCount(0);
  });

  test('10. Hộ báo cáo tiến độ đến hết số lượng (UI)', async () => {
    await phonePage.goto(`/vi/studio/de-xuat-tham-gia/${DEMO.requests.inProduction}`);
    await expect(phonePage.getByText('350 / 500')).toBeVisible();
    await phonePage.getByLabel('Số lượng đã xong').fill('500');
    await phonePage.getByRole('button', { name: 'Báo cáo' }).click();
    await expect(phonePage.getByText('500 / 500')).toBeVisible();
    await expect(phonePage.getByText('Đã xong').first()).toBeVisible();
  });

  test('11. Buyer xác nhận đã nhận hàng → biên nhận (UI)', async () => {
    await buyerPage.goto(`/vi/yeu-cau-bao-gia/${DEMO.requests.inProduction}`);
    await buyerPage.getByRole('button', { name: 'Xác nhận đã nhận hàng' }).click();
    await expect(buyerPage.getByText('Đã giao').first()).toBeVisible();
  });
});
