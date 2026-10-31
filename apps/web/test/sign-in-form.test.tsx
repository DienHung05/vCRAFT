import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInForm } from '@/features/auth/sign-in-form';
import { renderVi } from './render';

// `next-intl/navigation` cần runtime Next; thay bằng thẻ <a>.
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

const signInWithPassword = vi.fn();
const resend = vi.fn();

vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signInWithPassword, resend } }),
}));

const assign = vi.fn();

beforeEach(() => {
  signInWithPassword.mockReset();
  resend.mockReset();
  assign.mockReset();
  vi.stubGlobal('location', { ...window.location, assign });
});

async function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
}

describe('SignInForm', () => {
  it('sai thông tin: báo lỗi cụ thể bằng tiếng Việt và giữ nguyên email, mật khẩu đã nhập (NFR-UX-05)', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), {
        code: 'invalid_credentials',
        status: 400,
      }),
    });
    renderVi(<SignInForm next={null} />);
    await fill('buyer@vidu.vn', 'sai-mat-khau-1');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Email hoặc mật khẩu chưa đúng');
    expect(alert.textContent).not.toContain('Invalid login credentials');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('buyer@vidu.vn');
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).value).toBe('sai-mat-khau-1');
    expect(assign).not.toHaveBeenCalled();
  });

  it('email chưa xác minh: có nút gửi lại thư xác minh tới đúng email đã nhập', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Email not confirmed'), {
        code: 'email_not_confirmed',
        status: 400,
      }),
    });
    resend.mockResolvedValue({ error: null });
    renderVi(<SignInForm next={null} />);
    await fill('moi@vidu.vn', 'matkhau2026');

    fireEvent.click(await screen.findByRole('button', { name: 'Gửi lại thư xác minh' }));
    await waitFor(() =>
      expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'moi@vidu.vn' }),
    );
    expect(await screen.findByText(/Đã gửi lại thư xác minh tới moi@vidu\.vn/)).toBeTruthy();
  });

  it('thành công: về đích quay lại đã lọc an toàn', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderVi(<SignInForm next="/vi/yeu-cau-bao-gia/abc" />);
    await fill('buyer@vidu.vn', 'matkhau2026');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/vi/yeu-cau-bao-gia/abc'));
  });

  it('thành công không có đích: qua /auth/continue để vào trang theo vai trò', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderVi(<SignInForm next={null} />);
    await fill('buyer@vidu.vn', 'matkhau2026');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/continue?locale=vi'));
  });

  it('chưa nhập gì: chỉ ra từng ô còn thiếu và không gọi Supabase', async () => {
    renderVi(<SignInForm next={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByText('Nhập email của bạn.')).toBeTruthy();
    expect(await screen.findByText('Nhập mật khẩu.')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('báo cần đăng nhập khi bị guard chuyển tới', () => {
    renderVi(<SignInForm next="/vi/admin" needSignIn />);
    expect(screen.getByRole('status').textContent).toContain('cần đăng nhập');
  });
});
