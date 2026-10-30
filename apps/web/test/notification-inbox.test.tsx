import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { QuotationClient } from '@vcraft/api-client';
import type { QuotationNoticeDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { NotificationInbox } from '@/features/notifications/notification-inbox';
import { renderVi } from './render';

const requestId = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';

function notice(over: Partial<QuotationNoticeDto>): QuotationNoticeDto {
  return {
    id: 'n-1',
    version: 1,
    kind: 'QUOTATION_RECEIVED',
    requestId,
    quotationId: null,
    createdAt: '2026-10-29T00:00:00.000Z',
    readAt: null,
    ...over,
  };
}

describe('NotificationInbox', () => {
  it('shows the unread count and localized text per kind', async () => {
    const client = {
      listNotices: vi
        .fn()
        .mockResolvedValue([
          notice({ id: 'n-1' }),
          notice({ id: 'n-2', kind: 'ORDER_CANCELLED' }),
          notice({ id: 'n-3', kind: 'RFQ_INVITED', readAt: '2026-10-29T01:00:00.000Z' }),
        ]),
    } as unknown as QuotationClient;
    renderVi(<NotificationInbox client={client} />);
    await waitFor(() => expect(screen.getByText('2 chưa đọc')).toBeTruthy());
    expect(screen.getByText('Bạn nhận được một chào giá mới.')).toBeTruthy();
    expect(screen.getByText('Đơn hàng đã bị hủy.')).toBeTruthy();
    expect(screen.getByText('Bạn được mời tham gia một yêu cầu báo giá.')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Đã đọc' })).toHaveLength(2);
  });

  it('marks one notice read, then all', async () => {
    const markNoticeRead = vi
      .fn()
      .mockResolvedValue(notice({ id: 'n-1', readAt: '2026-10-29T02:00:00.000Z' }));
    const markAllNoticesRead = vi.fn().mockResolvedValue({ updated: 1 });
    const client = {
      listNotices: vi
        .fn()
        .mockResolvedValue([notice({ id: 'n-1' }), notice({ id: 'n-2', kind: 'ORDER_RECEIVED' })]),
      markNoticeRead,
      markAllNoticesRead,
    } as unknown as QuotationClient;
    renderVi(<NotificationInbox client={client} />);
    await waitFor(() => expect(screen.getByText('2 chưa đọc')).toBeTruthy());
    fireEvent.click(screen.getAllByRole('button', { name: 'Đã đọc' })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByText('1 chưa đọc')).toBeTruthy());
    expect(markNoticeRead).toHaveBeenCalledWith('n-1');
    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));
    await waitFor(() => expect(screen.getByText('Không có thông báo mới')).toBeTruthy());
    expect(markAllNoticesRead).toHaveBeenCalledTimes(1);
  });

  it('polls again every 15s while the tab is visible', async () => {
    vi.useFakeTimers();
    try {
      const listNotices = vi.fn().mockResolvedValue([]);
      const client = { listNotices } as unknown as QuotationClient;
      renderVi(<NotificationInbox client={client} />);
      await vi.advanceTimersByTimeAsync(0);
      expect(listNotices).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(15_000);
      expect(listNotices).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders nothing when the list cannot be loaded', async () => {
    const client = {
      listNotices: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as QuotationClient;
    const { container } = renderVi(<NotificationInbox client={client} />);
    await waitFor(() => expect(client.listNotices).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });
});
