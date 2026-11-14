import { act, screen } from '@testing-library/react';
import type { AccountClient, LiveEventsOptions } from '@vcraft/api-client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    },
  }),
  browserAccountClient: () => {
    throw new Error('not used');
  },
}));

// Captures the live subscription so the test can play the server's events.
const live: { options?: LiveEventsOptions; stopped: number } = { stopped: 0 };
vi.mock('@vcraft/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vcraft/api-client')>()),
  subscribeLiveEvents: (options: LiveEventsOptions) => {
    live.options = options;
    return () => {
      live.stopped++;
    };
  },
}));

describe('notification bell over the live stream (GH#93)', () => {
  it('updates the unread count as soon as the stream says so, and closes the stream on unmount', async () => {
    const client = {
      unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: 1 }),
      listNotifications: vi.fn().mockResolvedValue({ data: [], unreadCount: 1 }),
    } as unknown as AccountClient;
    const { unmount } = renderVi(<NotificationBell client={client} />);
    await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' });
    expect(live.options).toBeDefined();

    act(() => {
      live.options?.onStatus?.('live');
      live.options?.onEvent({ type: 'notifications', unreadCount: 4 });
    });
    expect(await screen.findByRole('button', { name: 'Thông báo, 4 chưa đọc' })).toBeTruthy();
    expect(await live.options?.getAccessToken()).toBe('tok');

    unmount();
    expect(live.stopped).toBe(1);
  });

  describe('new-notification cue (GH#536)', () => {
    const setup = async (initial: number) => {
      const client = {
        unreadNotificationCount: vi.fn().mockResolvedValue({ unreadCount: initial }),
        listNotifications: vi.fn().mockResolvedValue({ data: [], unreadCount: initial }),
      } as unknown as AccountClient;
      const view = renderVi(<NotificationBell client={client} />);
      await screen.findByRole('button', { name: `Thông báo, ${initial} chưa đọc` });
      const wrapper = () => view.container.querySelector('[data-ring]') as HTMLElement;
      const status = () => view.container.querySelector('[role="status"]') as HTMLElement;
      const emit = (unreadCount: number) =>
        act(() => {
          live.options?.onEvent({ type: 'notifications', unreadCount });
        });
      return { wrapper, status, emit };
    };

    it('stays still after the initial load', async () => {
      const { wrapper, status } = await setup(3);
      expect(wrapper().className).not.toContain('animate-bell-ring');
      expect(wrapper().dataset.ring).toBe('0');
      expect(status().textContent).toBe('');
    });

    it('rings and announces on an increase, ignores decreases, and re-rings on the next increase', async () => {
      const { wrapper, status, emit } = await setup(3);

      emit(4);
      expect(wrapper().className).toContain('animate-bell-ring');
      expect(wrapper().dataset.ring).toBe('1');
      expect(status().textContent).toBe('Có thông báo mới. 4 chưa đọc');

      emit(2);
      expect(wrapper().dataset.ring).toBe('1');
      expect(status().textContent).toBe('Có thông báo mới. 4 chưa đọc');

      emit(2);
      expect(wrapper().dataset.ring).toBe('1');

      emit(5);
      expect(wrapper().dataset.ring).toBe('2');
      expect(status().textContent).toBe('Có thông báo mới. 5 chưa đọc');
    });
  });
});
