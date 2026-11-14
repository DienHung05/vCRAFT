import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type DemoPaymentClient, type PaymentClient } from '@vcraft/api-client';
import type { DemoPaymentViewDto, OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoConfirmPage } from '@/features/payments/demo-confirm-page';
import { OrderPaymentPanel } from '@/features/payments/order-payment-panel';
import { PAYMENT_POLL_MS, PaymentCheckout } from '@/features/payments/payment-parts';
import { notify } from '@/lib/notify';
import { renderEn, renderVi } from './render';

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
    { method: 'MOMO', sandbox: true, minAmountVnd: 1_000, maxAmountVnd: null },
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

  it('shows a QR of the confirm link, the facts, the steps and the open-here link', async () => {
    renderVi(<PaymentCheckout payment={DEMO_PAYMENT} />);
    expect(screen.getByRole('heading', { name: 'Thanh toán qua VNPay' })).toBeTruthy();
    expect(screen.queryByTestId('demo-notice')).toBeNull();
    const qr = screen.getByRole('img', { name: 'Mã QR mở trang xác nhận thanh toán' });
    await waitFor(() => expect(qr.querySelector('svg')).not.toBeNull());
    // The QR is our own link, never a bank or wallet payload.
    expect(qrData.urls).toEqual([CONFIRM_URL]);
    expect(screen.getByTestId('demo-reference').textContent).toBe('VCPDEMO00001');
    expect(screen.getByText(/3\.000\.000/)).toBeTruthy();
    const steps = screen.getByRole('list', { name: 'Các bước thanh toán' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(within(steps).getByText(/Bấm “Xác nhận thanh toán”/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Mở trang xác nhận trên máy này' });
    expect(link.getAttribute('href')).toBe(CONFIRM_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
  });

  it.each(['SEPAY_TRANSFER', 'VNPAY', 'MOMO'] as const)(
    'uses normal checkout wording for %s in Vietnamese and English',
    (method) => {
      for (const render of [renderVi, renderEn]) {
        const view = render(
          <PaymentCheckout payment={{ ...DEMO_PAYMENT, method, referenceCode: 'VCP52800001' }} />,
        );
        expect(view.container.textContent).not.toMatch(/thử|demo|mẫu|test|sample/i);
        expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/thử|demo|test/i);
        expect(screen.getByRole('list').getAttribute('aria-label')).not.toMatch(/thử|demo|test/i);
        view.unmount();
      }
    },
  );
});

describe('order panel in demo mode', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(notify.success).mockClear();
  });

  it('starts a QR checkout with normal method hints and never redirects', async () => {
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
    const panel = await screen.findByTestId('payment-panel');
    expect(panel.textContent).not.toMatch(/thử|demo|mẫu/i);
    expect(within(panel).getByText(/Thẻ ATM nội địa/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'VNPay' }));
    expect(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã QR thanh toán' }));
    expect(await screen.findByTestId('demo-open-here')).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it.each([
    { render: renderVi, momo: 'Ví MoMo' },
    { render: renderEn, momo: 'MoMo wallet' },
  ])('allows a 60 million VND MoMo payment without rehearsal wording', async ({ render, momo }) => {
    const summary = {
      ...DEMO_SUMMARY,
      totalVnd: 200_000_000,
      depositAmountVnd: 60_000_000,
      balanceAmountVnd: 140_000_000,
    };
    render(
      <OrderPaymentPanel
        orderId={ORDER}
        orderStatus="ACCEPTED"
        client={asPayments({ orderPayments: vi.fn().mockResolvedValue(summary) })}
      />,
    );
    const radio = await screen.findByRole('radio', { name: momo });
    expect(radio).toHaveProperty('disabled', false);
    fireEvent.click(radio);
    expect(radio).toHaveProperty('checked', true);
    expect(screen.getByTestId('payment-panel').textContent).not.toMatch(
      /thử|demo|mẫu|test mode|sample/i,
    );
    expect(radio.getAttribute('aria-describedby')).not.toContain('-badge');
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
    expect(screen.getByRole('status', { name: 'Đang tải giao dịch…' })).toBeTruthy();
    expect(await screen.findByTestId('demo-amount')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Xác nhận thanh toán' })).toBeTruthy();
    expect(screen.queryByTestId('demo-notice')).toBeNull();
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

  it.each(['PENDING', 'PAID', 'FAILED', 'EXPIRED'] as const)(
    'uses normal confirmation wording in English for %s payments',
    async (status) => {
      const client = asDemo({
        view: vi.fn().mockResolvedValue(view({ status, referenceCode: 'VCP52800001' })),
      });
      const page = renderEn(
        <DemoConfirmPage reference="VCP52800001" token="secret-token" client={client} />,
      );
      await screen.findByTestId('demo-amount');
      expect(page.container.textContent).not.toMatch(/demo|test mode|sample/i);
      expect(screen.getByRole('heading', { name: 'Confirm payment' })).toBeTruthy();
    },
  );

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
        (screen.getByRole('button', { name: 'Hủy giao dịch' }) as HTMLButtonElement).disabled,
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
    fireEvent.click(screen.getByRole('button', { name: 'Hủy giao dịch' }));
    expect(await screen.findByText('Đã hủy giao dịch.')).toBeTruthy();
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
