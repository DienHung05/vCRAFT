import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { PaymentClient } from '@vcraft/api-client';
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
  simulateAvailable: false,
  payments: [],
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
    expect(await screen.findByText('Chuyển khoản / VietQR')).toBeTruthy();
    expect(screen.queryByText('VNPay (sandbox)')).toBeNull();
    expect(screen.queryByText('MoMo (sandbox)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() =>
      expect(createPayment).toHaveBeenCalledWith(ORDER, {
        kind: 'DEPOSIT',
        method: 'SEPAY_TRANSFER',
      }),
    );
    // The bank panel: QR, the exact amount and the payment code to type as the transfer content.
    expect(await screen.findByTestId('bank-details')).toBeTruthy();
    expect(screen.getByTestId('transfer-content').textContent).toBe('VCPAB3DEF7K9M');
    expect(screen.getByAltText('Mã VietQR của khoản chuyển này')).toBeTruthy();
    expect(screen.getByText(/Đang chờ tiền về/)).toBeTruthy();
  });

  it('lists the wallets too when the sandbox flag is on', async () => {
    const orderPayments = vi
      .fn()
      .mockResolvedValue({ ...SUMMARY, methods: ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'] });
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asClient({ orderPayments })}
      />,
    );
    expect(await screen.findByText('VNPay (sandbox)')).toBeTruthy();
    expect(screen.getByText('MoMo (sandbox)')).toBeTruthy();
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
      expect(recordOfflinePayment).toHaveBeenCalledWith(ORDER, {
        kind: 'BALANCE',
        note: 'Tiền mặt, biên lai 7',
      }),
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
});
