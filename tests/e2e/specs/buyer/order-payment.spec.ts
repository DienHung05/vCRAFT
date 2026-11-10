import { expect, type Route, test } from '@playwright/test';
import { DEMO, demoSkipReason, loginContext } from '../demo/support/demo-session';

/**
 * Core flow: payment of an accepted order, as deep as CI allows without any payment provider.
 *
 * The CI and demo deployments run with online payment switched off (no SePay account, sandbox wallets off), so
 * the real `/orders/:id/payments` answer offers no method and the buyer panel stays hidden. Our own UI does not
 * need a provider, so the first spec opens the real order page as the demo buyer and stubs only the payment API
 * calls in the browser (`page.route`): the panel then shows the deposit and balance amounts, the method choice,
 * the bank-transfer instructions after "Hiện thông tin chuyển khoản" and the cancelling of the pending payment. No request leaves
 * for SePay, VNPay or MoMo, and nothing is written to the database. The second spec opens the admin payments
 * board against the real API.
 *
 * The balance step is used because it renders for any order that is accepted, in production or delivered, so it
 * does not depend on how far the QR-to-receipt demo spec has moved the seeded order. Needs the same signed-in
 * setup as the other demo specs and skips without it.
 */
const skipReason = demoSkipReason();
test.skip(skipReason !== undefined, skipReason ?? '');

test.use({ locale: 'vi-VN' });

const ORDER_ID = DEMO.requests.inProduction;
const REFERENCE = 'VCE2EBALANCE1';

const summary = (payments: unknown[]) => ({
  orderId: ORDER_ID,
  totalVnd: 10_000_000,
  depositPercent: 30,
  depositAmountVnd: 3_000_000,
  balanceAmountVnd: 7_000_000,
  depositRequired: true,
  depositPaidAt: '2026-01-01T00:00:00.000Z',
  balancePaidAt: null,
  methods: ['SEPAY_TRANSFER'],
  methodOptions: [
    { method: 'SEPAY_TRANSFER', sandbox: false, minAmountVnd: 1, maxAmountVnd: null },
  ],
  simulateAvailable: false,
  demo: false,
  payments,
});

const pendingPayment = () => ({
  id: 'e2e00000-0000-4000-8000-000000000001',
  version: 1,
  orderId: ORDER_ID,
  kind: 'BALANCE',
  method: 'SEPAY_TRANSFER',
  provider: 'SEPAY',
  amountVnd: 7_000_000,
  referenceCode: REFERENCE,
  status: 'PENDING',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  paidAt: null,
  createdAt: new Date().toISOString(),
  refundedAt: null,
  refundReason: null,
  note: null,
  checkout: {
    type: 'BANK_TRANSFER',
    bankName: 'Test Bank',
    accountNumber: '0123456789',
    accountName: 'BAN QUAN LY LANG NGHE',
    transferContent: REFERENCE,
    qrImageUrl: null,
    qrPayload: null,
  },
});

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', json: body });

test('buyer sees the balance due, starts a bank transfer and can cancel it (payment API stubbed)', async ({
  page,
  context,
}) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  await loginContext(context, 'buyer', baseUrl);

  // A tiny in-memory order: creating a payment makes it pending, cancelling it makes it cancelled.
  let payments: unknown[] = [];
  await page.route(`**/api/v1/orders/${ORDER_ID}/payments`, (route) => {
    if (route.request().method() === 'POST') {
      const created = pendingPayment();
      payments = [created];
      return json(route, created, 201);
    }
    return json(route, summary(payments));
  });
  await page.route(`**/api/v1/payments/${REFERENCE}`, (route) => json(route, pendingPayment()));
  await page.route(`**/api/v1/payments/${REFERENCE}/cancel`, (route) => {
    const cancelled = { ...pendingPayment(), status: 'CANCELLED', checkout: null };
    payments = [cancelled];
    return json(route, cancelled);
  });

  await page.goto(`/vi/yeu-cau-bao-gia/${ORDER_ID}`);
  const panel = page.getByTestId('payment-panel');
  await expect(panel.getByRole('heading', { name: 'Thanh toán cho đơn hàng này' })).toBeVisible();

  // The amounts come from the server's summary: the 30% deposit (paid) and the balance still owed.
  await expect(panel.getByText('Đặt cọc (30%)')).toBeVisible();
  await expect(panel.getByText(/Đã thanh toán ngày/)).toBeVisible();
  await expect(panel.getByText('Chưa thanh toán')).toBeVisible();
  await expect(panel.getByText(/Thanh toán phần còn lại/)).toBeVisible();
  await expect(panel.getByRole('radio', { name: 'Chuyển khoản ngân hàng (VietQR)' })).toBeChecked();

  await panel.getByRole('button', { name: 'Hiện thông tin chuyển khoản', exact: true }).click();
  const bank = panel.getByTestId('bank-details');
  await expect(bank).toBeVisible();
  await expect(panel.getByTestId('transfer-content')).toHaveText(REFERENCE);
  await expect(bank).toContainText('0123456789');
  await expect(panel.getByTestId('payment-status')).toHaveText('Chờ thanh toán');

  await panel.getByRole('button', { name: 'Hủy khoản thanh toán này', exact: true }).click();
  await expect(panel.getByTestId('bank-details')).toHaveCount(0);
  await expect(panel.getByTestId('payment-status')).toHaveText('Đã hủy');
});

test('buyer lands on a failed wallet payment and is offered another way to pay (payment API stubbed)', async ({
  page,
  context,
}) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  await loginContext(context, 'buyer', baseUrl);
  const failed = {
    ...pendingPayment(),
    method: 'MOMO',
    provider: 'MOMO',
    status: 'FAILED',
    checkout: null,
  };
  await page.route(`**/api/v1/payments/${REFERENCE}`, (route) => json(route, failed));

  await page.goto(`/vi/thanh-toan/${REFERENCE}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Kết quả thanh toán' })).toBeVisible();
  const result = page.getByTestId('payment-result');
  await expect(
    result.getByRole('heading', { level: 2, name: 'Thanh toán chưa thành công' }),
  ).toBeVisible();
  await expect(result.getByTestId('payment-code')).toHaveText(REFERENCE);
  await expect(result.getByRole('link', { name: 'Chọn cách thanh toán khác' })).toBeVisible();
});

test('admin opens the payments board without any provider configured', async ({
  page,
  context,
}) => {
  const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/$/, '');
  await loginContext(context, 'admin', baseUrl);
  const response = await page.goto('/vi/admin/thanh-toan');
  expect(response?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { level: 1, name: 'Thanh toán' })).toBeVisible();
  // Real API: either rows or the empty state, never the load-failed state.
  await expect(page.getByText('Không tải được danh sách thanh toán.')).toHaveCount(0);
  await expect(page.getByLabel('Trạng thái')).toBeVisible();
});
