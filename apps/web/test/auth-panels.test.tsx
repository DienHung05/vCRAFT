import { fireEvent, screen, waitFor } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckEmailPanel } from '@/features/auth/check-email-panel';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { renderEn, renderVi } from './render';

// `next-intl/navigation` needs the Next runtime; use a plain <a>.
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  getPathname: ({ href }: { href: string }) => href,
}));

const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { resetPasswordForEmail, resend: vi.fn() } }),
}));

const kiln = vi.hoisted(() => ({ fire: vi.fn(), reset: vi.fn(), fail: vi.fn() }));
vi.mock('@/features/auth/kiln/kiln-feedback', () => ({ useKilnFeedback: () => kiln }));

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  kiln.fire.mockClear();
  kiln.reset.mockClear();
  kiln.fail.mockClear();
});

const recoveryOutcomes = [
  { name: 'success', error: null, throws: false },
  {
    name: 'email quota',
    error: { code: 'over_email_send_rate_limit', status: 429 },
    throws: false,
  },
  { name: 'HTTP 429', error: { status: 429 }, throws: false },
  {
    name: 'thrown email quota',
    error: { code: 'over_email_send_rate_limit', status: 429 },
    throws: true,
  },
];

describe.each(['vi', 'en'] as const)('password recovery privacy in %s', (locale) => {
  const render = locale === 'vi' ? renderVi : renderEn;
  const copy = messages[locale].auth;

  it.each(recoveryOutcomes)(
    'uses the generic panel for $name for existing and unknown emails',
    async ({ error, throws }) => {
      for (const email of ['existing@example.com', 'unknown@example.com']) {
        kiln.fail.mockClear();
        kiln.reset.mockClear();
        if (throws) resetPasswordForEmail.mockRejectedValue(error);
        else resetPasswordForEmail.mockResolvedValue({ error });
        const { unmount } = render(<ForgotPasswordForm />);
        fireEvent.change(screen.getByLabelText(copy.fields.email), { target: { value: email } });
        fireEvent.click(screen.getByRole('button', { name: copy.forgot.submit }));
        const heading = await screen.findByRole('heading', {
          level: 2,
          name: copy.forgot.sentTitle,
        });
        expect(screen.getByText(copy.forgot.sent.replace('{email}', email))).toBeTruthy();
        expect(screen.queryByRole('alert')).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(heading));
        expect(kiln.fail).not.toHaveBeenCalled();
        expect(kiln.reset).toHaveBeenCalledOnce();
        expect(resetPasswordForEmail).toHaveBeenLastCalledWith(email, {});
        unmount();
      }
    },
  );

  it.each([
    {
      name: 'CAPTCHA',
      error: { code: 'captcha_failed', status: 400 },
      key: 'captcha',
      throws: false,
    },
    { name: 'network', error: new TypeError('Failed to fetch'), key: 'network', throws: true },
  ] as const)('keeps $name failures actionable', async ({ error, key, throws }) => {
    if (throws) resetPasswordForEmail.mockRejectedValue(error);
    else resetPasswordForEmail.mockResolvedValue({ error });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(copy.fields.email), {
      target: { value: 'buyer@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: copy.forgot.submit }));
    expect((await screen.findByRole('alert')).textContent).toBe(copy.errors[key]);
    expect(kiln.fail).toHaveBeenCalledOnce();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });
});

describe('panels that replace an account form', () => {
  it('check-email: focus moves to the heading, and the panel is not a pre-filled live region', () => {
    const { container } = renderVi(<CheckEmailPanel email="a@b.vn" />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('check-email: hints that an existing account should sign in or reset the password (vi)', () => {
    renderVi(<CheckEmailPanel email="a@b.vn" />);
    expect(screen.getByText(/Nếu email này đã có tài khoản/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'đăng nhập' }).getAttribute('href')).toBe('/dang-nhap');
    expect(screen.getByRole('link', { name: 'Quên mật khẩu' }).getAttribute('href')).toBe(
      '/quen-mat-khau',
    );
  });

  it('check-email: the same hint in English', () => {
    renderEn(<CheckEmailPanel email="a@b.vn" />);
    expect(screen.getByText(/already has an account/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'sign in' }).getAttribute('href')).toBe('/dang-nhap');
    expect(screen.getByRole('link', { name: 'Forgot password' }).getAttribute('href')).toBe(
      '/quen-mat-khau',
    );
  });

  it('forgot password: after sending, focus moves to the new heading', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    renderVi(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.vn' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi/ }));
    const heading = await screen.findByRole('heading', { level: 2 });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.querySelector('[aria-live]')).toBeNull();
  });
});
