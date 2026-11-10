import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { PaymentClient } from '@vcraft/api-client';
import type { UnappliedPaymentDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AdminPaymentsList } from '@/features/admin/admin-payments-list';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ORDER = '00000000-0000-4000-8000-000000000001';

const ITEM: UnappliedPaymentDto = {
  id: '00000000-0000-4000-8000-0000000000b1',
  version: 1,
  provider: 'SEPAY',
  providerTxnId: '710001',
  amountVnd: 2_999_999,
  reason: 'AMOUNT_MISMATCH',
  status: 'OPEN',
  createdAt: '2026-11-10T03:00:00.000Z',
  referenceCode: 'VCPAB3DEF7K9M',
  expectedAmountVnd: 3_000_000,
  orderId: ORDER,
  orderTitle: 'Bộ ấm chén',
  resolvedAt: null,
  resolvedNote: null,
};

const PAID_ROW = {
  id: 'p-1',
  version: 2,
  orderId: ORDER,
  orderTitle: 'Bộ ấm chén',
  buyerName: 'Lan',
  kind: 'DEPOSIT',
  method: 'SEPAY_TRANSFER',
  provider: 'SEPAY',
  amountVnd: 3_000_000,
  status: 'PAID',
  referenceCode: 'REF-PAID',
  createdAt: '2026-11-09T03:00:00.000Z',
  refundNeededAt: '2026-11-10T03:00:00.000Z',
};

describe('AdminPaymentsList: unapplied money (GH#417)', () => {
  it('lists open items and marks one handled with a note', async () => {
    const unappliedPayments = vi.fn().mockResolvedValueOnce({ data: [ITEM], nextCursor: null });
    const resolveUnappliedPayment = vi.fn().mockResolvedValue({ ...ITEM, status: 'RESOLVED' });
    const adminPayments = vi.fn().mockResolvedValue({ data: [PAID_ROW], nextCursor: null });
    const client = {
      adminPayments,
      unappliedPayments,
      resolveUnappliedPayment,
    } as unknown as PaymentClient;
    renderVi(<AdminPaymentsList client={client} />);

    await screen.findByText('Sai số tiền');
    expect(unappliedPayments).toHaveBeenCalledWith({ status: 'OPEN' });
    // The paid payment of a cancelled order is flagged in the main table.
    expect(await screen.findByText('Cần hoàn tiền')).toBeTruthy();

    const resolve = screen.getByRole('button', { name: 'Đánh dấu đã xử lý' });
    fireEvent.click(resolve);
    expect(await screen.findByText('Hãy viết ghi chú ngắn (ít nhất 3 ký tự).')).toBeTruthy();
    expect(resolveUnappliedPayment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Đã xử lý thế nào'), {
      target: { value: 'Hoàn lại qua chuyển khoản' },
    });
    fireEvent.click(resolve);
    await waitFor(() =>
      expect(resolveUnappliedPayment).toHaveBeenCalledWith(ITEM.id, 1, {
        note: 'Hoàn lại qua chuyển khoản',
      }),
    );
    await waitFor(() => expect(screen.queryByText('Sai số tiền')).toBeNull());
    expect(await screen.findByText('Đã đánh dấu xử lý.')).toBeTruthy();
  });

  it('says so when nothing is waiting', async () => {
    const client = {
      adminPayments: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
      unappliedPayments: vi.fn().mockResolvedValue({ data: [], nextCursor: null }),
    } as unknown as PaymentClient;
    renderVi(<AdminPaymentsList client={client} />);
    expect(await screen.findByText('Không có khoản tiền nào đang chờ xử lý.')).toBeTruthy();
  });
});
