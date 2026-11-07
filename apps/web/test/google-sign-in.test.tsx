import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as callback } from '@/app/auth/callback/route';
import { GoogleSignIn, googleCallbackUrl } from '@/features/auth/google-sign-in';
import { setRememberPreference } from '@/lib/auth/remember';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

const signInWithOAuth = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signInWithOAuth } }),
}));

const exchangeCodeForSession = vi.fn();
const updateUser = vi.fn();
vi.mock('@/lib/auth/supabase-server', () => ({
  createServerSupabase: async () => ({ auth: { exchangeCodeForSession, updateUser } }),
}));

beforeEach(() => {
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
  exchangeCodeForSession.mockReset();
  updateUser.mockReset().mockResolvedValue({ error: null });
});

const request = (query: string) =>
  ({ nextUrl: new URL(`http://localhost:3000/auth/callback?${query}`) }) as unknown as NextRequest;

describe('GoogleSignIn', () => {
  it('builds the callback URL with locale, consent and a filtered return path', () => {
    expect(googleCallbackUrl('https://vcraft.vn', 'vi', '/vi/yeu-cau-bao-gia')).toBe(
      'https://vcraft.vn/auth/callback?locale=vi&consent=1&next=%2Fvi%2Fyeu-cau-bao-gia',
    );
    expect(googleCallbackUrl('https://vcraft.vn', 'en', null)).toBe(
      'https://vcraft.vn/auth/callback?locale=en&consent=1',
    );
  });

  it('starts Supabase OAuth with Google and the callback as redirect', async () => {
    renderVi(<GoogleSignIn next="/vi/san-pham" />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?locale=vi&consent=1&next=%2Fvi%2Fsan-pham`,
        },
      }),
    );
  });

  it('sets the remember marker before starting OAuth', async () => {
    setRememberPreference(true);
    let markerAtOAuth: boolean | undefined;
    signInWithOAuth.mockImplementation(async () => {
      markerAtOAuth = document.cookie.includes('vcraft-remember=0');
      return { error: null };
    });
    const { unmount } = renderVi(<GoogleSignIn next={null} remember={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalled());
    expect(markerAtOAuth).toBe(true);
    unmount();

    // Default (the register page): a stale marker is cleared.
    renderVi(<GoogleSignIn next={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(2));
    expect(document.cookie).not.toContain('vcraft-remember');
  });

  it('stays disabled until the register page consent is ticked, and says when it fails', async () => {
    const { unmount } = renderVi(<GoogleSignIn next={null} disabled />);
    expect(
      (screen.getByRole('button', { name: 'Tiếp tục với Google' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    unmount();
    renderVi(<GoogleSignIn next={null} />);
    signInWithOAuth.mockResolvedValue({ error: new Error('provider disabled') });
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    expect(await screen.findByText(/Chưa đăng nhập được bằng Google/)).toBeTruthy();
  });
});

describe('/auth/callback', () => {
  it('exchanges the code, records consent on a first Google account and returns to next', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });
    const res = await callback(request('code=abc&consent=1&locale=vi&next=%2Fvi%2Fsan-pham'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(updateUser).toHaveBeenCalledWith({
      data: { privacy_policy_version: expect.any(String) },
    });
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/vi/san-pham');
  });

  it('keeps an existing consent and goes to the role landing without next', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { user_metadata: { privacy_policy_version: '2026-10-01' } } },
      error: null,
    });
    const res = await callback(request('code=abc&consent=1&locale=en'));
    expect(updateUser).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toBe('/auth/continue?locale=en');
  });

  it('sends a cancelled or failed sign-in back to the sign-in page, never to an outside next', async () => {
    const cancelled = await callback(request('error=access_denied&locale=vi'));
    expect(cancelled.headers.get('location')).toBe('/vi/dang-nhap?error=oauth_failed');
    exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: new Error('stale') });
    const stale = await callback(request('code=old&locale=vi&next=https%3A%2F%2Fevil.test'));
    expect(stale.headers.get('location')).toBe('/vi/dang-nhap?error=oauth_failed');
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { user_metadata: {} } },
      error: null,
    });
    const outside = await callback(request('code=ok&locale=vi&next=%2F%2Fevil.test'));
    expect(outside.headers.get('location')).toBe('/auth/continue?locale=vi');
  });
});
