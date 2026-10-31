import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { AccountClient } from '@vcraft/api-client';
import type { NotificationDto } from '@vcraft/contracts';
import { pathnames } from '@vcraft/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BELL_POLL_MS, NotificationBell } from '@/features/notifications/notification-bell';
import { renderVi } from './render';

// `next-intl/navigation` cần runtime Next; thay bằng thẻ <a> đổi đích sang URL tiếng Việt.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string; params?: Record<string, string> };
    children: React.ReactNode;
  }) => {
    let url: string;
    if (typeof href === 'string') url = href;
    else {
      const entry = pathnames[href.pathname as keyof typeof pathnames];
      url = typeof entry === 'string' ? entry : entry.vi;
      for (const [key, value] of Object.entries(href.params ?? {})) {
        url = url.replace(`[${key}]`, value);
      }
    }
    return (
      <a
        href={url}
        {...rest}
        onClick={(event) => {
          event.preventDefault();
          (rest as { onClick?: () => void }).onClick?.();
        }}
      >
        {children}
      </a>
    );
  },
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => null,
  browserAccountClient: () => {
    throw new Error('not used');
  },
}));

const requestId = '0b8f7a5e-1c2d-4e3f-a5b6-c7d8e9f0a1b2';

function item(over: Partial<NotificationDto>): NotificationDto {
  return {
    id: 'n-1',
    version: 1,
    type: 'QUOTATION_RECEIVED',
    target: { page: 'BUYER_RFQ', id: requestId },
    createdAt: '2026-10-29T00:00:00.000Z',
    readAt: null,
    ...over,
  };
}

function fakeClient(over: Record<string, unknown>) {
  return {
    unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 0 }),
    listNotifications: vi.fn().mockResolvedValue({ data: [], unreadCount: 0 }),
    markNotificationRead: vi.fn().mockResolvedValue(item({})),
    markAllNotificationsRead: vi.fn().mockResolvedValue({ updated: 0 }),
    ...over,
  } as unknown as AccountClient;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('NotificationBell', () => {
  it('renders nothing for a guest (no session client)', () => {
    const { container } = renderVi(<NotificationBell />);
    expect(container.textContent).toBe('');
  });

  it('shows the unread count on the bell and in its accessible name', async () => {
    const client = fakeClient({
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 3 }),
    });
    renderVi(<NotificationBell client={client} />);
    const bell = await screen.findByRole('button', { name: 'Thông báo, 3 chưa đọc' });
    expect(bell.textContent).toBe('3');
  });

  it('caps a big count at 99+', async () => {
    const client = fakeClient({
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 250 }),
    });
    renderVi(<NotificationBell client={client} />);
    expect((await screen.findByRole('button', { name: /250 chưa đọc/ })).textContent).toBe('99+');
  });

  it('shows the empty state when opened with no notifications', async () => {
    renderVi(<NotificationBell client={fakeClient({})} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thông báo' }));
    expect(await screen.findByText('Chưa có thông báo nào.')).toBeTruthy();
  });

  it('lists notifications with text per type and a link to the related page', async () => {
    const client = fakeClient({
      listNotifications: vi.fn().mockResolvedValue({
        unreadCount: 2,
        data: [
          item({ id: 'n-1' }),
          item({
            id: 'n-2',
            type: 'HOUSEHOLD_APPROVED',
            target: { page: 'STUDIO_APPLICATION', id: null },
          }),
          item({
            id: 'n-3',
            type: 'ORDER_CANCELLED',
            target: null,
            readAt: '2026-10-29T01:00:00Z',
          }),
        ],
      }),
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 2 }),
    });
    renderVi(<NotificationBell client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: /chưa đọc/ }));
    const quote = await screen.findByRole('link', { name: /Bạn nhận được một chào giá mới/ });
    expect(quote.getAttribute('href')).toBe(`/yeu-cau-bao-gia/${requestId}`);
    const approved = screen.getByRole('link', { name: /Hồ sơ hộ của bạn đã được chấp nhận/ });
    expect(approved.getAttribute('href')).toBe('/studio/ho-so');
    // Thông báo không có đích vẫn hiện, nhưng không phải liên kết
    expect(screen.getByText('Đơn hàng đã bị hủy.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Đơn hàng đã bị hủy/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Cài đặt thông báo' }).getAttribute('href')).toBe(
      '/tai-khoan',
    );
  });

  it('marks one notification read from its button, then all', async () => {
    const markNotificationRead = vi.fn().mockResolvedValue(item({}));
    const markAllNotificationsRead = vi.fn().mockResolvedValue({ updated: 1 });
    const client = fakeClient({
      listNotifications: vi.fn().mockResolvedValue({
        unreadCount: 2,
        data: [item({ id: 'n-1' }), item({ id: 'n-2', type: 'ORDER_CANCELLED' })],
      }),
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 2 }),
      markNotificationRead,
      markAllNotificationsRead,
    });
    renderVi(<NotificationBell client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Đánh dấu đã đọc: Bạn nhận được một chào giá mới.',
      }),
    );
    expect(markNotificationRead).toHaveBeenCalledWith('n-1');
    await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' });

    fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
    await screen.findByRole('button', { name: 'Thông báo' });
    expect(screen.queryByRole('button', { name: 'Đánh dấu tất cả đã đọc' })).toBeNull();
  });

  it('marks a notification read when its link is followed and closes the panel', async () => {
    const markNotificationRead = vi.fn().mockResolvedValue(item({}));
    const client = fakeClient({
      listNotifications: vi.fn().mockResolvedValue({ unreadCount: 1, data: [item({})] }),
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 1 }),
      markNotificationRead,
    });
    renderVi(<NotificationBell client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: /chưa đọc/ }));
    fireEvent.click(await screen.findByRole('link', { name: /chào giá mới/ }));
    expect(markNotificationRead).toHaveBeenCalledWith('n-1');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('link', { name: /chào giá mới/ })).toBeNull();
  });

  it('ignores a slower poll that returns a stale count after mark all', async () => {
    let finishSlowPoll: (value: { data: NotificationDto[]; unreadCount: number }) => void =
      () => {};
    const listNotifications = vi
      .fn()
      .mockResolvedValueOnce({ unreadCount: 1, data: [item({})] })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSlowPoll = resolve;
          }),
      );
    const client = fakeClient({
      listNotifications,
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 1 }),
      markAllNotificationsRead: vi.fn().mockResolvedValue({ updated: 1 }),
    });
    renderVi(<NotificationBell client={client} />);
    fireEvent.click(await screen.findByRole('button', { name: /chưa đọc/ }));
    await screen.findByRole('link', { name: /chào giá mới/ });
    // Lần hỏi thứ hai (đang bay) sẽ trả số cũ sau khi người dùng đã bấm "đọc tất cả"
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /chưa đọc/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh dấu tất cả đã đọc' }));
    await screen.findByRole('button', { name: 'Thông báo' });
    await act(async () => finishSlowPoll({ unreadCount: 1, data: [item({})] }));
    expect(screen.getByRole('button', { name: 'Thông báo' })).toBeTruthy();
  });

  it('closes on Escape', async () => {
    renderVi(<NotificationBell client={fakeClient({})} />);
    const bell = await screen.findByRole('button', { name: 'Thông báo' });
    fireEvent.click(bell);
    expect(bell.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(bell.getAttribute('aria-expanded')).toBe('false');
  });

  it('polls the unread count every interval while the tab is visible, and pauses when hidden', async () => {
    vi.useFakeTimers();
    const unreadNotificationCount = vi.fn().mockResolvedValue({ unreadCount: 0 });
    renderVi(<NotificationBell client={fakeClient({ unreadNotificationCount })} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(unreadNotificationCount).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(BELL_POLL_MS);
    expect(unreadNotificationCount).toHaveBeenCalledTimes(2);

    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    await vi.advanceTimersByTimeAsync(BELL_POLL_MS * 3);
    expect(unreadNotificationCount).toHaveBeenCalledTimes(2);

    // Tab hiện lại thì hỏi ngay, không đợi hết nhịp
    hidden.mockReturnValue(false);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(unreadNotificationCount).toHaveBeenCalledTimes(3);
  });

  it('keeps the last count when a poll fails', async () => {
    vi.useFakeTimers();
    const unreadNotificationCount = vi
      .fn()
      .mockResolvedValueOnce({ unreadCount: 4 })
      .mockRejectedValue(new Error('offline'));
    renderVi(<NotificationBell client={fakeClient({ unreadNotificationCount })} />);
    await vi.advanceTimersByTimeAsync(BELL_POLL_MS);
    expect(screen.getByRole('button', { name: 'Thông báo, 4 chưa đọc' })).toBeTruthy();
  });
});
