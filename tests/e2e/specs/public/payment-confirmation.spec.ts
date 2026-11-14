import { expect, test } from '@playwright/test';

// Exercise the public phone page without a session or merchant credentials.
// The HTTP boundary is stubbed here; payments.integration.test.ts verifies settlement through the real API.
for (const locale of ['vi', 'en'] as const) {
  for (const method of ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'] as const) {
    test(`${locale} ${method} confirms a 60 million VND payment without rehearsal labels`, async ({
      page,
    }, testInfo) => {
      const reference = 'VCP52800001';
      const token = 'browser-payment-token';
      const payment = {
        referenceCode: reference,
        amountVnd: 60_000_000,
        method,
        kind: 'DEPOSIT',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
      await page.route(`**/api/v1/payments/demo/${reference}?k=${token}`, (route) =>
        route.fulfill({ json: payment }),
      );
      await page.route(`**/api/v1/payments/demo/${reference}/confirm`, async (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({ token, outcome: 'PAID' });
        await route.fulfill({ json: { ...payment, status: 'PAID' } });
      });

      await page.goto(`/${locale}/thanh-toan/thu/${reference}?k=${token}`);
      const card = page.getByTestId('demo-confirm-card');
      await expect(card.getByTestId('demo-amount')).toContainText(/60[.,]000[.,]000/);
      await expect(card).not.toContainText(/thử|demo|mẫu|test mode|sample/i);
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: locale === 'vi' ? 'Xác nhận thanh toán' : 'Confirm payment',
        }),
      ).toBeVisible();
      await expect(page.getByTestId('demo-notice')).toHaveCount(0);
      const pendingScreenshot = testInfo.outputPath('payment-pending.png');
      await page.screenshot({ path: pendingScreenshot, fullPage: true });
      await testInfo.attach('Payment awaiting confirmation', {
        path: pendingScreenshot,
        contentType: 'image/png',
      });

      await card
        .getByRole('button', {
          name: locale === 'vi' ? 'Xác nhận thanh toán' : 'Confirm payment',
          exact: true,
        })
        .click();
      await expect(card.getByTestId('demo-result')).toContainText(
        locale === 'vi' ? 'Đã xác nhận.' : 'Confirmed.',
      );
      await expect(card).not.toContainText(/thử|demo|mẫu|test mode|sample/i);
      await expect(
        card.getByRole('link', {
          name: locale === 'vi' ? 'Xem kết quả thanh toán' : 'View the payment result',
        }),
      ).toBeVisible();
      const paidScreenshot = testInfo.outputPath('payment-paid.png');
      await page.screenshot({ path: paidScreenshot, fullPage: true });
      await testInfo.attach('Payment confirmed', {
        path: paidScreenshot,
        contentType: 'image/png',
      });
    });
  }
}
