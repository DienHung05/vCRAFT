import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { AdminPaymentDto, UnappliedPaymentDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AdminPaymentsList } from '@/features/admin/admin-payments-list';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ORDER = '00000000-0000-4000-8000-000000000001';

const UNAPPLIED: UnappliedPaymentDto = {
  id: '00000000-0000-4000-8000-0000000000b1',
  version: 1,
  paymentId: '00000000-0000-4000-8000-0000000000a1',
  orderId: ORDER,
  orderTitle: 'Bát men lam',
  provider: 'SEPAY',
  providerTxnId: '991',
  referenceCode: 'VCPAB3DEF7K9M',
  amountVnd: 2_999_000,
  expectedAmountVnd: 3_000_000,
  reason: 'AMOUNT_MISMATCH',
  status: 'OPEN',
  receivedAt: '2026-11-09T10:00:00.000Z',
  resolvedAt: null,
  resolution: null,
};

const OWED: AdminPaymentDto = {
  id: '00000000-0000-4000-8000-0000000000a2',
  version: 2,
  orderId: ORDER,
  orderTitle: 'Bát men lam',
  buyerName: 'Lan',
  kind: 'DEPOSIT',
  method: 'SEPAY_TRANSFER',
  provider: 'SEPAY',
  amountVnd: 3_000_000,
  referenceCode: 'VCPOWED000001',
  status: 'PAID',
  expiresAt: null,
  paidAt: '2026-11-09T10:00:00.000Z',
  createdAt: '2026-11-09T09:00:00.000Z',
  refundedAt: null,
  refundReason: null,
  note: null,
  checkout: null,
  refundDueAt: '2026-11-10T01:00:00.000Z',
};

function client(overrides: Partial<PaymentClient> = {}) {
  return {
    adminPayments: vi.fn().mockResolvedValue({ data: [OWED], nextCursor: null }),
    unappliedPayments: vi.fn().mockResolvedValue({ data: [UNAPPLIED], nextCursor: null }),
    resolveUnappliedPayment: vi.fn().mockResolvedValue({ ...UNAPPLIED, status: 'RESOLVED' }),
    ...overrides,
  } as unknown as PaymentClient;
}

describe('admin payments: money to handle by hand (GH#417)', () => {
  it('shows unmatched incoming money and records how it was handled', async () => {
    const api = client();
    renderVi(<AdminPaymentsList client={api} />);
    const section = await screen.findByTestId('admin-unapplied-payments');
    expect(within(section).getByText('Sai số tiền')).toBeTruthy();
    expect(within(section).getByText('VCPAB3DEF7K9M')).toBeTruthy();
    fireEvent.click(within(section).getByRole('button', { name: 'Ghi nhận đã xử lý' }));
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    expect(within(section).getByRole('alert').textContent).toMatch(/ít nhất 3 ký tự/);
    fireEvent.change(within(section).getByLabelText('Đã xử lý thế nào'), {
      target: { value: 'Đã chuyển trả người mua' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(api.resolveUnappliedPayment).toHaveBeenCalledWith(UNAPPLIED.id, 1, {
        resolution: 'Đã chuyển trả người mua',
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('admin-unapplied-payments')).toBeNull());
  });

  it('reloads the list when someone else handled the money first', async () => {
    const api = client({
      resolveUnappliedPayment: vi.fn().mockRejectedValue(new ApiError('STALE_VERSION', 409)),
    });
    renderVi(<AdminPaymentsList client={api} />);
    const section = await screen.findByTestId('admin-unapplied-payments');
    fireEvent.click(within(section).getByRole('button', { name: 'Ghi nhận đã xử lý' }));
    fireEvent.change(within(section).getByLabelText('Đã xử lý thế nào'), {
      target: { value: 'Đã chuyển trả' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.unappliedPayments).toHaveBeenCalledTimes(2));
  });

  it('marks a paid payment of a cancelled order as owed back and filters on it', async () => {
    const api = client();
    renderVi(<AdminPaymentsList client={api} />);
    expect(await screen.findByTestId('payment-refund-due')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Chỉ khoản cần hoàn lại (đơn đã hủy)'));
    await waitFor(() => expect(api.adminPayments).toHaveBeenLastCalledWith({ refundDue: 'true' }));
  });
});
