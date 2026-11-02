import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckEmailPanel } from '@/features/auth/check-email-panel';
import { ForgotPasswordForm } from '@/features/auth/forgot-password-form';
import { renderVi } from './render';

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

beforeEach(() => resetPasswordForEmail.mockReset());

describe('panels that replace an account form', () => {
  it('check-email: focus moves to the heading, and the panel is not a pre-filled live region', () => {
    const { container } = renderVi(<CheckEmailPanel email="a@b.vn" />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(document.activeElement).toBe(heading);
    expect(heading.getAttribute('tabindex')).toBe('-1');
    expect(container.querySelector('[aria-live]')).toBeNull();
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
