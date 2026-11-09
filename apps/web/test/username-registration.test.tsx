import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '@/features/auth/register-form';
import { renderEn, renderVi } from './render';

const { signUp, usernameAvailable } = vi.hoisted(() => ({
  signUp: vi.fn(),
  usernameAvailable: vi.fn(),
}));
vi.mock('@/features/auth/public-auth', () => ({ signUp, usernameAvailable }));
vi.mock('@/lib/auth/supabase-browser', () => ({ browserSupabase: () => ({ auth: {} }) }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === 'string' ? href : href.pathname}>{children}</a>,
}));

beforeEach(() => {
  signUp.mockReset().mockResolvedValue(undefined);
  usernameAvailable.mockReset().mockResolvedValue(true);
});

describe('Username registration', () => {
  it('checks availability and registers a normalized username with the email', async () => {
    renderVi(<RegisterForm />);
    fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'New.Buyer' } });
    expect(await screen.findByText('Bạn có thể dùng tên đăng nhập này.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }));
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'new.buyer',
          email: 'buyer@example.com',
          locale: 'vi',
        }),
      ),
    );
    expect(await screen.findByText('Kiểm tra hộp thư của bạn')).toBeTruthy();
  });

  it.each(['Abcdefgh1', 'abcdefghij1', 'ABCDEFGHIJ1', 'Abcdefghijk'])(
    'rejects invalid new password %s before registration',
    async (password) => {
      renderEn(<RegisterForm />);
      fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new.buyer' } });
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@example.com' } });
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(
        await screen.findByText(
          password.length < 10
            ? 'The password needs at least 10 characters.'
            : 'The password needs uppercase and lowercase letters and a digit.',
        ),
      ).toBeTruthy();
      expect(signUp).not.toHaveBeenCalled();
    },
  );

  it('shows an English validation message for a reserved username', async () => {
    renderEn(<RegisterForm />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ADMIN' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('This username is reserved for system accounts. Choose another.'),
    ).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('reports a name claimed since the availability check and keeps the fields', async () => {
    signUp.mockRejectedValue({ code: 'USERNAME_TAKEN', status: 409 });
    renderEn(<RegisterForm />);
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new.buyer' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'buyer@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'This username is already taken',
    );
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('new.buyer');
  });
});
