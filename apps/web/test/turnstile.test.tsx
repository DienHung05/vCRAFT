import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { SignInForm } from '@/features/auth/sign-in-form';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  getPathname: ({ href }: { href: string }) => href,
}));

// Stands in for the Cloudflare widget: a button that "solves" the check and hands back a token.
vi.mock('@marsidev/react-turnstile', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    Turnstile: forwardRef(function FakeTurnstile(
      { onSuccess }: { onSuccess: (token: string) => void },
      ref,
    ) {
      useImperativeHandle(ref, () => ({ reset: () => undefined }));
      return (
        <button type="button" onClick={() => onSuccess('turnstile-token')}>
          fake-turnstile
        </button>
      );
    }),
  };
});

const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signInWithPassword, resetPasswordForEmail } }),
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
  signInWithPassword.mockReset();
  resetPasswordForEmail.mockReset();
  vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const fillSignIn = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@vidu.vn' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'mat-khau-1' } });
};

describe('Turnstile on auth forms (GH#84)', () => {
  it('asks for the check before signing in, then sends the token to Supabase', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderVi(<SignInForm next="/vi" />);
    fillSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Tôi không phải robot');
    expect(signInWithPassword).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'fake-turnstile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'buyer@vidu.vn',
        password: 'mat-khau-1',
        options: { captchaToken: 'turnstile-token' },
      }),
    );
  });

  it('explains a token Supabase rejected', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('captcha protection: request disallowed'), {
        code: 'captcha_failed',
        status: 400,
      }),
    });
    renderVi(<SignInForm next={null} />);
    fillSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'fake-turnstile' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Tôi không phải robot');
  });

  it('sends the token with a password recovery request', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    renderVi(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@vidu.vn' } });
    fireEvent.click(screen.getByRole('button', { name: 'fake-turnstile' }));
    fireEvent.click(screen.getByRole('button', { name: /Gửi/ }));
    await waitFor(() =>
      expect(resetPasswordForEmail).toHaveBeenCalledWith('buyer@vidu.vn', {
        captchaToken: 'turnstile-token',
      }),
    );
  });

  it('shows no widget and sends no token when no site key is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', '');
    signInWithPassword.mockResolvedValue({ error: null });
    renderVi(<SignInForm next="/vi" />);
    expect(screen.queryByRole('button', { name: 'fake-turnstile' })).toBeNull();
    fillSignIn();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'buyer@vidu.vn',
        password: 'mat-khau-1',
        options: {},
      }),
    );
  });
});
