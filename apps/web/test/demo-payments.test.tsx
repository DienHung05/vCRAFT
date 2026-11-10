import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type DemoPaymentClient, type PaymentClient } from '@vcraft/api-client';
import type { DemoPaymentViewDto, OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoConfirmPage } from '@/features/payments/demo-confirm-page';
import { OrderPaymentPanel } from '@/features/payments/order-payment-panel';
import { PAYMENT_POLL_MS, PaymentCheckout } from '@/features/payments/payment-parts';
import { notify } from '@/lib/notify';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const qrData = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock('qr-code-styling', () => ({
  default: class {
    constructor(options: { data: string }) {
      qrData.urls.push(options.data);
    }
    append(el: HTMLElement) {
      el.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
    }
  },
}));
vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const ORDER = '00000000-0000-4000-8000-000000000001';
const CONFIRM_URL = 'https://vcraft.test/vi/thanh-toan/thu/VCPDEMO00001?k=secret-token';

const DEMO_PAYMENT: PaymentDto = {
  id: '00000000-0000-4000-8000-0000000000d1',
  version: 1,
  orderId: ORDER,
  kind: 'DEPOSIT',
  method: 'VNPAY',
  provider: 'VNPAY',
  amountVnd: 3_000_000,
  referenceCode: 'VCPDEMO00001',
  status: 'PENDING',
  expiresAt: '2026-11-10T10:00:00.000Z',
  paidAt: null,
  createdAt: '2026-11-09T10:00:00.000Z',
  refundedAt: null,
  refundReason: null,
  note: null,
  checkout: { type: 'DEMO', confirmUrl: CONFIRM_URL },
};

const DEMO_SUMMARY: OrderPaymentsDto = {
  orderId: ORDER,
  totalVnd: 10_000_000,
  depositPercent: 30,
  depositAmountVnd: 3_000_000,
  balanceAmountVnd: 7_000_000,
  depositRequired: false,
  depositPaidAt: null,
  balancePaidAt: null,
  methods: ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'],
  methodOptions: [
    { method: 'SEPAY_TRANSFER', sandbox: true, minAmountVnd: 1, maxAmountVnd: null },
    { method: 'VNPAY', sandbox: true, minAmountVnd: 5_000, maxAmountVnd: 999_999_999 },
    { method: 'MOMO', sandbox: true, minAmountVnd: 1_000, maxAmountVnd: 50_000_000 },
  ],
  simulateAvailable: false,
  demo: true,
  payments: [],
};

const asPayments = (methods: Partial<PaymentClient>) => methods as unknown as PaymentClient;
const asDemo = (methods: Partial<DemoPaymentClient>) => methods as unknown as DemoPaymentClient;

describe('DEMO checkout', () => {
  beforeEach(() => {
    qrData.urls.length = 0;
  });

  it('shows a QR of the confirm link, the facts, the steps, the open-here link and the notice', async () => {
    renderVi(<PaymentCheckout payment={DEMO_PAYMENT} />);
    expect(screen.getByRole('heading', { name: 'Thanh toán thử qua VNPay' })).toBeTruthy();
    expect(screen.getByTestId('demo-notice').textContent).toBe(
      'Thanh toán thử — không trừ tiền thật',
    );
    const qr = screen.getByRole('img', { name: 'Mã QR mở trang xác nhận thanh toán thử' });
    await waitFor(() => expect(qr.querySelector('svg')).not.toBeNull());
    // The QR is our own link, never a bank or wallet payload.
    expect(qrData.urls).toEqual([CONFIRM_URL]);
    expect(screen.getByTestId('demo-reference').textContent).toBe('VCPDEMO00001');
    expect(screen.getByText(/3\.000\.000/)).toBeTruthy();
    const steps = screen.getByRole('list', { name: 'Các bước thanh toán thử' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText(/Bấm “Xác nhận thanh toán”/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Mở trang xác nhận trên máy này' });
    expect(link.getAttribute('href')).toBe(CONFIRM_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it('titles a bank-transfer rehearsal "Quét mã để thanh toán thử"', () => {
    renderVi(<PaymentCheckout payment={{ ...DEMO_PAYMENT, method: 'SEPAY_TRANSFER' }} />);
    expect(screen.getByRole('heading', { name: 'Quét mã để thanh toán thử' })).toBeTruthy();
  });
});

describe('order panel in demo mode', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(notify.success).mockClear();
  });

  it('labels the start button, the hint and the note for demo, and never redirects', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const orderPayments = vi
      .fn()
      .mockResolvedValueOnce(DEMO_SUMMARY)
      .mockResolvedValue({ ...DEMO_SUMMARY, payments: [DEMO_PAYMENT] });
    const createPayment = vi.fn().mockResolvedValue(DEMO_PAYMENT);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asPayments({ orderPayments, createPayment })}
      />,
    );
    expect(await screen.findByText('Chế độ demo: không có giao dịch tiền thật.')).toBeTruthy();
    expect(screen.queryByText(/Chế độ thử nghiệm/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'VNPay' }));
    expect(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' }));
    expect(await screen.findByTestId('demo-open-here')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('announces and toasts once when the polled demo payment turns paid', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const paid = { ...DEMO_PAYMENT, status: 'PAID' as const, paidAt: '2026-11-09T10:05:00.000Z' };
    const orderPayments = vi
      .fn()
      .mockResolvedValueOnce({ ...DEMO_SUMMARY, payments: [DEMO_PAYMENT] })
      .mockResolvedValue({ ...DEMO_SUMMARY, depositPaidAt: paid.paidAt, payments: [paid] });
    const getPayment = vi.fn().mockResolvedValue(paid);
    renderVi(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asPayments({ orderPayments, getPayment })}
      />,
    );
    await screen.findByTestId('demo-open-here');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_POLL_MS + 100);
    });
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Đã nhận thanh toán'));
    expect(notify.success).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('payment-announcement').textContent).toBe('Đã nhận thanh toán');
  });
});

describe('demo confirm page', () => {
  const view = (over: Partial<DemoPaymentViewDto> = {}): DemoPaymentViewDto => ({
    referenceCode: 'VCPDEMO00001',
    amountVnd: 3_000_000,
    method: 'MOMO',
    kind: 'DEPOSIT',
    status: 'PENDING',
    expiresAt: '2026-11-10T10:00:00.000Z',
    ...over,
  });

  it('confirms: amount first, then the success state with a link to the result', async () => {
    const client = asDemo({
      view: vi.fn().mockResolvedValue(view()),
      confirm: vi.fn().mockResolvedValue(view({ status: 'PAID' })),
    });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token="secret-token" client={client} />);
    expect(screen.getByRole('status', { name: 'Đang tải giao dịch thử…' })).toBeTruthy();
    expect(await screen.findByTestId('demo-amount')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Xác nhận thanh toán thử' })).toBeTruthy();
    expect(screen.getByText('Thanh toán thử — không trừ tiền thật')).toBeTruthy();
    expect(screen.getByText('VCPDEMO00001')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    expect(
      await screen.findByText('Đã xác nhận. Quay lại máy tính hoặc trang đơn hàng để xem kết quả.'),
    ).toBeTruthy();
    expect(client.confirm).toHaveBeenCalledWith('VCPDEMO00001', {
      token: 'secret-token',
      outcome: 'PAID',
    });
    expect(screen.getByRole('link', { name: 'Xem kết quả thanh toán' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xác nhận thanh toán' })).toBeNull();
  });

  it('disables both buttons while sending', async () => {
    let finish: (v: DemoPaymentViewDto) => void = () => {};
    const client = asDemo({
      view: vi.fn().mockResolvedValue(view()),
      confirm: vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve))),
    });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token="secret-token" client={client} />);
    await screen.findByTestId('demo-amount');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Hủy giao dịch thử' }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
    await act(async () => finish(view({ status: 'PAID' })));
  });

  it('declines: says the demo payment was cancelled', async () => {
    const client = asDemo({
      view: vi.fn().mockResolvedValue(view()),
      confirm: vi.fn().mockResolvedValue(view({ status: 'FAILED' })),
    });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token="secret-token" client={client} />);
    await screen.findByTestId('demo-amount');
    fireEvent.click(screen.getByRole('button', { name: 'Hủy giao dịch thử' }));
    expect(await screen.findByText('Đã hủy giao dịch thử.')).toBeTruthy();
    expect(client.confirm).toHaveBeenCalledWith('VCPDEMO00001', {
      token: 'secret-token',
      outcome: 'FAILED',
    });
  });

  it('shows a friendly message for a bad token (404) and for a link without one', async () => {
    const client = asDemo({
      view: vi.fn().mockRejectedValue(new ApiError('NOT_FOUND', 404)),
    });
    const first = renderVi(
      <DemoConfirmPage reference="VCPDEMO00001" token="wrong" client={client} />,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Liên kết không hợp lệ hoặc đã hết hạn');
    first.unmount();
    const none = asDemo({ view: vi.fn() });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token={null} client={none} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Liên kết không hợp lệ');
    expect(none.view).not.toHaveBeenCalled();
  });

  it('says so when the payment was already paid, without offering the buttons', async () => {
    const client = asDemo({ view: vi.fn().mockResolvedValue(view({ status: 'PAID' })) });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token="secret-token" client={client} />);
    expect(await screen.findByText('Khoản này đã được thanh toán')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Xác nhận thanh toán' })).toBeNull();
  });

  it('shows an error with role=alert when sending fails, and keeps the buttons', async () => {
    const client = asDemo({
      view: vi.fn().mockResolvedValue(view()),
      confirm: vi.fn().mockRejectedValue(new ApiError('INTERNAL_ERROR', 500)),
    });
    renderVi(<DemoConfirmPage reference="VCPDEMO00001" token="secret-token" client={client} />);
    await screen.findByTestId('demo-amount');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thanh toán' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Chưa gửi được xác nhận');
    expect(
      (screen.getByRole('button', { name: 'Xác nhận thanh toán' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
