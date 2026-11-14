import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminOrderPayments } from '@/features/admin/admin-order-payments';
import { OrderPaymentPanel } from '@/features/payments/order-payment-panel';
import { PaymentStatusPage } from '@/features/payments/payment-status-page';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ORDER = '00000000-0000-4000-8000-000000000001';

const BANK_PAYMENT: PaymentDto = {
  id: '00000000-0000-4000-8000-0000000000a1',
  version: 1,
  orderId: ORDER,
  kind: 'DEPOSIT',
  method: 'SEPAY_TRANSFER',
  provider: 'SEPAY',
  amountVnd: 3_000_000,
  referenceCode: 'VCPAB3DEF7K9M',
  status: 'PENDING',
  expiresAt: '2026-11-10T10:00:00.000Z',
  paidAt: null,
  createdAt: '2026-11-09T10:00:00.000Z',
  refundedAt: null,
  refundReason: null,
  note: null,
  checkout: {
    type: 'BANK_TRANSFER',
    bankName: 'MB Bank',
    accountNumber: '0123456789',
    accountName: 'BAN QUAN LY LANG NGHE BAT TRANG',
    transferContent: 'VCPAB3DEF7K9M',
    qrImageUrl: 'https://qr.sepay.vn/img?acc=0123456789',
    qrPayload: null,
  },
};

const SUMMARY: OrderPaymentsDto = {
  orderId: ORDER,
  totalVnd: 10_000_000,
  depositPercent: 30,
  depositAmountVnd: 3_000_000,
  balanceAmountVnd: 7_000_000,
  depositRequired: true,
  depositPaidAt: null,
  balancePaidAt: null,
  methods: ['SEPAY_TRANSFER'],
  methodOptions: [
    { method: 'SEPAY_TRANSFER', sandbox: false, minAmountVnd: 1, maxAmountVnd: null },
  ],
  simulateAvailable: false,
  demo: false,
  payments: [],
};

const walletSummary = (): OrderPaymentsDto => ({
  ...SUMMARY,
  methods: ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'],
  methodOptions: [
    { method: 'SEPAY_TRANSFER', sandbox: false, minAmountVnd: 1, maxAmountVnd: null },
    { method: 'VNPAY', sandbox: true, minAmountVnd: 10_000, maxAmountVnd: 500_000_000 },
    { method: 'MOMO', sandbox: true, minAmountVnd: 1_000, maxAmountVnd: 50_000_000 },
  ],
});

const WALLET_PAYMENT: PaymentDto = {
  ...BANK_PAYMENT,
  id: '00000000-0000-4000-8000-0000000000b2',
  method: 'MOMO',
  provider: 'MOMO',
  referenceCode: 'VCPAMOMO0001',
  checkout: {
    type: 'REDIRECT',
    url: 'https://test-payment.momo.vn/pay/1',
    deeplink: 'momo://pay?x=1',
    qrImageUrl: null,
  },
};

const asClient = (methods: Partial<PaymentClient>) => methods as unknown as PaymentClient;

describe('buyer payment panel', () => {
  it('shows nothing when online payment is off for this deployment', async () => {
    const orderPayments = vi.fn().mockResolvedValue({
      ...SUMMARY,
      methods: [],
      depositRequired: false,
    });
    const { container } = renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    await waitFor(() => expect(orderPayments).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="payment-panel"]')).toBeNull();
  });

  it('offers only the methods the server lists and starts the chosen deposit', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValueOnce(SUMMARY)
      .mockResolvedValue({ ...SUMMARY, payments: [BANK_PAYMENT] });
    const createPayment = vi.fn().mockResolvedValue(BANK_PAYMENT);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments, createPayment })}
      />,
    );
    expect(await screen.findByText('Chuyển khoản ngân hàng (VietQR)')).toBeTruthy();
    expect(screen.queryByText('VNPay')).toBeNull();
    expect(screen.queryByText('Ví MoMo')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Hiện thông tin chuyển khoản' }));
    await waitFor(() =>
      expect(createPayment).toHaveBeenCalledWith(
        ORDER,
        { kind: 'DEPOSIT', method: 'SEPAY_TRANSFER' },
        { idempotencyKey: expect.any(String) },
      ),
    );
    // The bank panel: QR, the exact amount and the payment code to type as the transfer content.
    expect(await screen.findByTestId('bank-details')).toBeTruthy();
    expect(screen.getByTestId('transfer-content').textContent).toBe('VCPAB3DEF7K9M');
    expect(screen.getByAltText('Mã VietQR của khoản chuyển này')).toBeTruthy();
    expect(screen.getByText(/Đang chờ tiền về/)).toBeTruthy();
  });

  it('offers a late deposit on an order in production when no deposit is required, with the real balance', async () => {
    // The server prices a balance at the whole total once production started without a deposit (#426).
    const orderPayments = vi.fn().mockResolvedValue({
      ...SUMMARY,
      depositRequired: false,
      balanceAmountVnd: 10_000_000,
    });
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="IN_PRODUCTION"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByText('Chuyển khoản ngân hàng (VietQR)')).toBeTruthy();
    const legend = screen.getByRole('group').querySelector('legend');
    expect(legend?.textContent).toMatch(/3\.000\.000/);
    const balance = screen.getByText('Phần còn lại').nextElementSibling;
    expect(balance?.textContent).toMatch(/7\.000\.000/);
    expect(balance?.textContent).not.toMatch(/10\.000\.000/);
  });

  it('shows the balance after the expected deposit before the deposit is paid', async () => {
    const orderPayments = vi.fn().mockResolvedValue({ ...SUMMARY, depositRequired: false });
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    await screen.findByText('Chuyển khoản ngân hàng (VietQR)');
    expect(screen.getByText('Phần còn lại').nextElementSibling?.textContent).toMatch(/7\.000\.000/);
  });

  it('offers no payment on an order in production when the deposit is required and unpaid', async () => {
    const orderPayments = vi.fn().mockResolvedValue(SUMMARY);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="IN_PRODUCTION"
        client={asClient({ orderPayments })}
      />,
    );
    await screen.findByTestId('payment-panel');
    expect(screen.queryByText('Chuyển khoản ngân hàng (VietQR)')).toBeNull();
  });

  it('never labels a sandbox option as test mode', async () => {
    const orderPayments = vi.fn().mockResolvedValue(walletSummary());
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    const vnpay = await screen.findByTestId('payment-method-VNPAY');
    expect(within(vnpay).getByText(/Thẻ ATM nội địa/)).toBeTruthy();
    expect(screen.queryByText(/Thử nghiệm|thử nghiệm|Chế độ/)).toBeNull();
    // The first enabled option is the default.
    expect(screen.getByRole('radio', { name: 'Chuyển khoản ngân hàng (VietQR)' })).toHaveProperty(
      'checked',
      true,
    );
  });

  it('disables an option whose limit excludes the amount, with the reason, and skips it as default', async () => {
    const summary = walletSummary();
    summary.methodOptions[0] = { ...summary.methodOptions[0], maxAmountVnd: 2_000_000 } as never;
    const orderPayments = vi.fn().mockResolvedValue(summary);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    const card = await screen.findByTestId('payment-method-SEPAY_TRANSFER');
    expect(
      within(card).getByText(/Số tiền vượt hạn mức .*2\.000\.000.* của phương thức này/),
    ).toBeTruthy();
    const radio = within(card).getByRole('radio') as HTMLInputElement;
    expect(radio.disabled).toBe(true);
    expect(radio.getAttribute('aria-disabled')).toBe('true');
    expect(radio.getAttribute('aria-describedby')).toContain('-reason');
    // VNPay is the first enabled option and so the default; its button label follows.
    expect(screen.getByRole('radio', { name: 'VNPay' })).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'Thanh toán qua VNPay' })).toBeTruthy();
  });

  it('says so when the amount fits no method', async () => {
    const summary = {
      ...SUMMARY,
      methodOptions: [
        { method: 'SEPAY_TRANSFER', sandbox: false, minAmountVnd: 5_000_000, maxAmountVnd: null },
      ],
    } as OrderPaymentsDto;
    const orderPayments = vi.fn().mockResolvedValue(summary);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByText(/Số tiền dưới mức tối thiểu .*5\.000\.000/)).toBeTruthy();
    expect(screen.getByText(/chưa phù hợp với hạn mức của phương thức nào/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Hiện thông tin chuyển khoản/ })).toBeNull();
  });

  it('falls back to the plain method list when the server sends no options', async () => {
    const { methodOptions: _omit, ...rest } = walletSummary();
    const orderPayments = vi.fn().mockResolvedValue(rest);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByTestId('payment-method-MOMO')).toBeTruthy();
    expect(screen.queryByText(/Thử nghiệm/)).toBeNull();
  });

  it('goes straight to the provider after starting a wallet payment', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const orderPayments = vi.fn().mockResolvedValue(walletSummary());
    const createPayment = vi.fn().mockResolvedValue(WALLET_PAYMENT);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments, createPayment })}
      />,
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'Ví MoMo' }));
    const button = screen.getByRole('button', { name: 'Thanh toán qua MoMo' });
    fireEvent.click(button);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://test-payment.momo.vn/pay/1'));
    expect(createPayment).toHaveBeenCalledWith(
      ORDER,
      { kind: 'DEPOSIT', method: 'MOMO' },
      { idempotencyKey: expect.any(String) },
    );
    expect(screen.getByText('Đang chuyển tới MoMo…')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Thanh toán qua MoMo' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    vi.unstubAllGlobals();
  });

  it('explains an amount outside the limits when the server refuses it', async () => {
    const orderPayments = vi.fn().mockResolvedValue(SUMMARY);
    const createPayment = vi
      .fn()
      .mockRejectedValue(new ApiError('PAYMENT_AMOUNT_OUT_OF_RANGE', 409));
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments, createPayment })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Hiện thông tin chuyển khoản' }));
    expect((await screen.findByRole('alert')).textContent).toContain('nằm ngoài hạn mức');
  });

  it('shows the wallet waiting line and the continue button for a pending wallet payment', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...walletSummary(), payments: [WALLET_PAYMENT] });
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByText(/Đang chờ MoMo xác nhận/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục thanh toán trên MoMo' })).toBeTruthy();
    // The app deeplink is for touch devices only.
    expect(screen.queryByRole('link', { name: 'Mở ứng dụng MoMo' })).toBeNull();
  });

  it('offers the MoMo app deeplink on a touch device', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...walletSummary(), payments: [WALLET_PAYMENT] });
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByRole('link', { name: 'Mở ứng dụng MoMo' })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});

describe('payment result page', () => {
  const FAILED: PaymentDto = { ...WALLET_PAYMENT, status: 'FAILED', checkout: null };
  const PAID: PaymentDto = {
    ...WALLET_PAYMENT,
    status: 'PAID',
    checkout: null,
    paidAt: '2026-11-09T11:00:00.000Z',
  };

  it('thanks the buyer on a paid payment and links back to the order', async () => {
    renderVi(
      <PaymentStatusPage
        reference="VCPAMOMO0001"
        client={asClient({ getPayment: vi.fn().mockResolvedValue(PAID) })}
      />,
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Thanh toán thành công' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Kết quả thanh toán' })).toBeTruthy();
    expect(screen.getByTestId('payment-code').textContent).toBe('VCPAMOMO0001');
    expect(screen.getByText('Thời điểm thanh toán')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Về đơn hàng' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Chọn cách thanh toán khác' })).toBeNull();
  });

  it('offers another way to pay on a failed wallet payment and says no money was taken', async () => {
    renderVi(
      <PaymentStatusPage
        reference="VCPAMOMO0001"
        client={asClient({ getPayment: vi.fn().mockResolvedValue(FAILED) })}
      />,
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Thanh toán chưa thành công' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Chọn cách thanh toán khác' })).toBeTruthy();
    expect(screen.getByText(/chưa ghi nhận khoản tiền nào/)).toBeTruthy();
    expect(screen.getByText(/Nếu tiền đã rời khỏi tài khoản của bạn/)).toBeTruthy();
    expect(screen.queryByText('Thời điểm thanh toán')).toBeNull();
  });

  describe('while a wallet payment is still pending', () => {
    beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
    afterEach(() => vi.useRealTimers());

    it('adds the "you can close this page" hint after 20 s', async () => {
      renderVi(
        <PaymentStatusPage
          reference="VCPAMOMO0001"
          client={asClient({ getPayment: vi.fn().mockResolvedValue(WALLET_PAYMENT) })}
        />,
      );
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Đang xác nhận thanh toán' }),
      ).toBeTruthy();
      expect(screen.getByText(/kết quả thường có trong vài giây/)).toBeTruthy();
      expect(screen.queryByText(/Vẫn chưa có kết quả/)).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });
      expect(screen.getByText(/Vẫn chưa có kết quả/)).toBeTruthy();
    });
  });

  it('reuses the start key after a client failure and rotates it when the method changes', async () => {
    const orderPayments = vi.fn().mockResolvedValue(walletSummary());
    const createPayment = vi.fn().mockRejectedValue(new TypeError('Request timed out'));
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments, createPayment })}
      />,
    );
    await screen.findByRole('button', { name: 'Hiện thông tin chuyển khoản' });
    const start = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Hiện thông tin chuyển khoản' }));
    start();
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Hiện thông tin chuyển khoản' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    start();
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2));
    const first = createPayment.mock.calls[0]?.[2]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(createPayment.mock.calls[1]?.[2]?.idempotencyKey).toBe(first);

    fireEvent.click(screen.getByRole('radio', { name: /VNPay/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán qua VNPay' }));
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(3));
    expect(createPayment.mock.calls[2]?.[1]).toEqual({ kind: 'DEPOSIT', method: 'VNPAY' });
    expect(createPayment.mock.calls[2]?.[2]?.idempotencyKey).not.toBe(first);
  });

  it('gives the payment form a fresh start key after a start succeeds', async () => {
    const orderPayments = vi.fn().mockResolvedValue(walletSummary());
    const createPayment = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue(BANK_PAYMENT);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments, createPayment })}
      />,
    );
    await screen.findByRole('button', { name: 'Hiện thông tin chuyển khoản' });
    const start = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Hiện thông tin chuyển khoản' }));
    start();
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Hiện thông tin chuyển khoản' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    start();
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(2));
    const retried = createPayment.mock.calls[1]?.[2]?.idempotencyKey;
    expect(createPayment.mock.calls[0]?.[2]?.idempotencyKey).toBe(retried);
    await waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: 'Hiện thông tin chuyển khoản' })
          .hasAttribute('disabled'),
      ).toBe(false),
    );
    start();
    await waitFor(() => expect(createPayment).toHaveBeenCalledTimes(3));
    expect(createPayment.mock.calls[2]?.[2]?.idempotencyKey).not.toBe(retried);
  });
});

describe('payment status polling', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('polls a pending payment every 3 s and stops once it is paid', async () => {
    const paid = {
      ...BANK_PAYMENT,
      status: 'PAID' as const,
      checkout: null,
      paidAt: '2026-11-09T11:00:00.000Z',
    };
    const getPayment = vi
      .fn()
      .mockResolvedValueOnce(BANK_PAYMENT)
      .mockResolvedValueOnce(BANK_PAYMENT)
      .mockResolvedValue(paid);
    renderVi(<PaymentStatusPage reference="VCPAB3DEF7K9M" client={asClient({ getPayment })} />);
    expect((await screen.findAllByTestId('payment-status'))[0]?.textContent).toBe('Chờ thanh toán');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    await waitFor(() =>
      expect(screen.getByTestId('payment-status').textContent).toBe('Đã thanh toán'),
    );
    const calls = getPayment.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(getPayment.mock.calls.length).toBe(calls);
  });
});

describe('administration payment panel', () => {
  const paid: PaymentDto = {
    ...BANK_PAYMENT,
    status: 'PAID',
    checkout: null,
    paidAt: '2026-11-09T11:00:00.000Z',
  };

  it('records an offline balance with a note', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, depositPaidAt: paid.paidAt, payments: [paid] });
    const recordOfflinePayment = vi.fn().mockResolvedValue({});
    renderVi(
      <AdminOrderPayments
        orderId={ORDER}
        client={asClient({ orderPayments, recordOfflinePayment })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ghi nhận phần còn lại' }));
    expect(await screen.findByText('Hãy ghi một ghi chú ngắn (ít nhất 3 ký tự).')).toBeTruthy();
    expect(recordOfflinePayment).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Cách thanh toán'), {
      target: { value: 'Tiền mặt, biên lai 7' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận phần còn lại' }));
    await waitFor(() =>
      expect(recordOfflinePayment).toHaveBeenCalledWith(
        ORDER,
        { kind: 'BALANCE', note: 'Tiền mặt, biên lai 7' },
        { idempotencyKey: expect.any(String) },
      ),
    );
  });

  it('links the note input to its error and moves focus to it when submit fails', async () => {
    const orderPayments = vi.fn().mockResolvedValue({ ...SUMMARY, payments: [paid] });
    renderVi(<AdminOrderPayments orderId={ORDER} client={asClient({ orderPayments })} />);
    const input = (await screen.findByLabelText('Cách thanh toán')) as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận phần còn lại' }));
    const alert = await screen.findByText('Hãy ghi một ghi chú ngắn (ít nhất 3 ký tự).');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(document.activeElement).toBe(input);
  });

  it('links the refund reason to its error and focuses it when the reason is missing', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, depositPaidAt: paid.paidAt, payments: [paid] });
    renderVi(<AdminOrderPayments orderId={ORDER} client={asClient({ orderPayments })} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh dấu hoàn lại' }));
    const dialog = await screen.findByRole('dialog');
    const reason = dialog.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.click(dialog.querySelectorAll('button')[1] as HTMLButtonElement);
    await waitFor(() => expect(reason.getAttribute('aria-invalid')).toBe('true'));
    const describedBy = reason.getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(document.getElementById(describedBy)?.textContent).toContain('3 ký tự');
    expect(document.activeElement).toBe(reason);
  });

  it('marks a paid payment refunded with a reason, at the version it was read', async () => {
    const orderPayments = vi.fn().mockResolvedValue({
      ...SUMMARY,
      depositPaidAt: paid.paidAt,
      payments: [{ ...paid, version: 4 }],
    });
    const refundPayment = vi.fn().mockResolvedValue({});
    renderVi(
      <AdminOrderPayments orderId={ORDER} client={asClient({ orderPayments, refundPayment })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh dấu hoàn lại' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(dialog.querySelector('textarea') as HTMLTextAreaElement, {
      target: { value: 'Đơn bị hủy' },
    });
    fireEvent.click(dialog.querySelectorAll('button')[1] as HTMLButtonElement);
    await waitFor(() =>
      expect(refundPayment).toHaveBeenCalledWith(paid.id, 4, { reason: 'Đơn bị hủy' }),
    );
  });

  it('offers the sandbox transfer only when the server says it is available', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, simulateAvailable: true, payments: [BANK_PAYMENT] });
    const simulateTransfer = vi.fn().mockResolvedValue({});
    renderVi(
      <AdminOrderPayments orderId={ORDER} client={asClient({ orderPayments, simulateTransfer })} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Giả lập chuyển khoản (sandbox)' }));
    await waitFor(() => expect(simulateTransfer).toHaveBeenCalledWith(BANK_PAYMENT.id));
  });

  it('reuses the offline-payment key after a client failure and rotates it when the note changes', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, depositPaidAt: paid.paidAt, payments: [paid] });
    const recordOfflinePayment = vi.fn().mockRejectedValue(new TypeError('Request timed out'));
    renderVi(
      <AdminOrderPayments
        orderId={ORDER}
        client={asClient({ orderPayments, recordOfflinePayment })}
      />,
    );
    const input = (await screen.findByLabelText('Cách thanh toán')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Tiền mặt, biên lai 8' } });
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận phần còn lại' }));
    submit();
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ghi nhận phần còn lại' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    submit();
    await waitFor(() => expect(recordOfflinePayment).toHaveBeenCalledTimes(2));
    const first = recordOfflinePayment.mock.calls[0]?.[2]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(recordOfflinePayment.mock.calls[1]?.[2]?.idempotencyKey).toBe(first);

    fireEvent.change(input, { target: { value: 'Tiền mặt, biên lai 9' } });
    submit();
    await waitFor(() => expect(recordOfflinePayment).toHaveBeenCalledTimes(3));
    expect(recordOfflinePayment.mock.calls[2]?.[1]).toEqual({
      kind: 'BALANCE',
      note: 'Tiền mặt, biên lai 9',
    });
    expect(recordOfflinePayment.mock.calls[2]?.[2]?.idempotencyKey).not.toBe(first);
  });

  it('gives the offline payment form a fresh key after it succeeds', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, depositPaidAt: paid.paidAt, payments: [paid] });
    const recordOfflinePayment = vi.fn().mockResolvedValue({});
    renderVi(
      <AdminOrderPayments
        orderId={ORDER}
        client={asClient({ orderPayments, recordOfflinePayment })}
      />,
    );
    const input = (await screen.findByLabelText('Cách thanh toán')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Tiền mặt, biên lai 7' } });
    const submit = () =>
      fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận phần còn lại' }));
    submit();
    await waitFor(() => expect(recordOfflinePayment).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input.value).toBe(''));
    fireEvent.change(input, { target: { value: 'Tiền mặt, biên lai 7' } });
    submit();
    await waitFor(() => expect(recordOfflinePayment).toHaveBeenCalledTimes(2));
    const first = recordOfflinePayment.mock.calls[0]?.[2]?.idempotencyKey;
    expect(recordOfflinePayment.mock.calls[1]?.[2]?.idempotencyKey).not.toBe(first);
  });
});
