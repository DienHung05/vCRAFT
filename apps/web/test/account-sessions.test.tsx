import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AccountClient } from '@vcraft/api-client';
import type { LoginEventDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSecurity } from '@/features/account/account-security';
import { renderEn, renderVi } from './render';

const signOut = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signOut } }),
  browserAccountClient: () => ({}),
}));

beforeEach(() => signOut.mockReset());

const event = (over: Partial<LoginEventDto>): LoginEventDto => ({
  id: 'a',
  method: 'password',
  aal: 'aal1',
  browser: null,
  country: null,
  current: false,
  signedOutAt: null,
  createdAt: '2026-11-03T02:00:00.000Z',
  ...over,
});

const clientWith = (items: LoginEventDto[], extra: Record<string, unknown> = {}) =>
  ({ loginEvents: vi.fn().mockResolvedValue({ items }), ...extra }) as unknown as AccountClient;

describe('Sign-in sessions (FR-AUTH-05)', () => {
  it('shows the browser, the country and which row is this device', async () => {
    renderEn(
      <AccountSecurity
        client={clientWith([
          event({ id: 'a', browser: 'Chrome · Windows', country: 'VN', current: true }),
          event({ id: 'b', browser: null, country: null, signedOutAt: '2026-11-03T03:00:00.000Z' }),
        ])}
      />,
    );
    expect(await screen.findByText('Chrome · Windows · Vietnam')).toBeTruthy();
    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getByText('Unknown browser')).toBeTruthy();
    expect(screen.getByText('Signed out')).toBeTruthy();
  });

  it('shows only the newest rows when limited', async () => {
    renderVi(
      <AccountSecurity
        limit={1}
        client={clientWith([
          event({ id: 'a', browser: 'Firefox · Linux' }),
          event({ id: 'b', browser: 'Safari · macOS' }),
        ])}
      />,
    );
    expect(await screen.findByText('Firefox · Linux')).toBeTruthy();
    expect(screen.queryByText('Safari · macOS')).toBeNull();
  });

  it('signs out the other devices after confirming and shows the refreshed list', async () => {
    const signOutOtherSessions = vi.fn().mockResolvedValue({
      items: [
        event({ id: 'a', current: true }),
        event({ id: 'b', signedOutAt: '2026-11-03T04:00:00.000Z' }),
      ],
    });
    renderVi(
      <AccountSecurity
        client={clientWith([event({ id: 'a', current: true }), event({ id: 'b' })], {
          signOutOtherSessions,
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất các thiết bị khác' }));
    const confirm = screen
      .getAllByRole('button', { name: 'Đăng xuất các thiết bị khác' })
      .at(-1) as HTMLElement;
    fireEvent.click(confirm);
    await waitFor(() => expect(signOutOtherSessions).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toBe('Đã đăng xuất các thiết bị khác.');
    expect(await screen.findByText('Đã đăng xuất')).toBeTruthy();
    // The Supabase scope 'others' runs on the server; the browser never signs itself out.
    expect(signOut).not.toHaveBeenCalled();
  });

  it('reports a failure plainly', async () => {
    renderVi(
      <AccountSecurity
        client={clientWith([event({})], {
          signOutOtherSessions: vi.fn().mockRejectedValue(new Error('network')),
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất các thiết bị khác' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Đăng xuất các thiết bị khác' }).at(-1) as HTMLElement,
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Chưa đăng xuất được các thiết bị khác. Thử lại sau ít phút.',
    );
  });
});
