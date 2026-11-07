import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type KilnFeedback, KilnFeedbackContext } from '@/features/auth/kiln/kiln-feedback';
import { SignInForm } from '@/features/auth/sign-in-form';
import { setRememberPreference } from '@/lib/auth/remember';
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
const signInWithOAuth = vi.fn();

vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signInWithPassword, resend, signInWithOAuth } }),
}));

const assign = vi.fn();

beforeEach(() => {
  signInWithPassword.mockReset();
  resend.mockReset();
  signInWithOAuth.mockReset().mockResolvedValue({ error: null });
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
      expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'moi@vidu.vn', options: {} }),
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

describe('SignInForm remember me', () => {
  const marker = () => (document.cookie.includes('vcraft-remember=0') ? '0' : null);

  beforeEach(() => {
    setRememberPreference(true);
  });

  it('shows the checkbox ticked by default', () => {
    renderVi(<SignInForm next={null} />);
    expect((screen.getByLabelText('Ghi nhớ đăng nhập') as HTMLInputElement).checked).toBe(true);
  });

  it('writes the session marker before signing in when it is unticked', async () => {
    let markerAtSignIn: string | null = 'unset';
    signInWithPassword.mockImplementation(async () => {
      markerAtSignIn = marker();
      return { error: null };
    });
    renderVi(<SignInForm next={null} />);
    fireEvent.click(screen.getByLabelText('Ghi nhớ đăng nhập'));
    await fill('buyer@vidu.vn', 'matkhau2026');
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(markerAtSignIn).toBe('0');
  });

  it('clears a stale marker before signing in when it is ticked', async () => {
    setRememberPreference(false);
    let markerAtSignIn: string | null = 'unset';
    signInWithPassword.mockImplementation(async () => {
      markerAtSignIn = marker();
      return { error: null };
    });
    renderVi(<SignInForm next={null} />);
    await fill('buyer@vidu.vn', 'matkhau2026');
    await waitFor(() => expect(signInWithPassword).toHaveBeenCalled());
    expect(markerAtSignIn).toBeNull();
  });

  it('hands the choice to the Google button', async () => {
    renderVi(<SignInForm next={null} />);
    fireEvent.click(screen.getByLabelText('Ghi nhớ đăng nhập'));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục với Google' }));
    await waitFor(() => expect(marker()).toBe('0'));
  });
});

describe('SignInForm in the kiln card', () => {
  function feedbackSpy() {
    let release: () => void = () => {};
    const feedback: KilnFeedback = {
      fire: vi.fn(),
      fail: vi.fn(),
      reset: vi.fn(),
      seal: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      ),
    };
    return { feedback, release: () => release() };
  }

  function renderInCard(feedback: KilnFeedback) {
    return renderVi(
      <KilnFeedbackContext value={feedback}>
        <SignInForm next={null} />
      </KilnFeedbackContext>,
    );
  }

  it('fires on submit, seals on success, and only navigates once the seal has landed', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const { feedback, release } = feedbackSpy();
    renderInCard(feedback);
    await fill('buyer@vidu.vn', 'matkhau2026');

    await waitFor(() => expect(feedback.seal).toHaveBeenCalledTimes(1));
    // The destination goes to seal() so the browser can prerender it while the stamp plays.
    expect(feedback.seal).toHaveBeenCalledWith('/auth/continue?locale=vi');
    expect(feedback.fire).toHaveBeenCalledTimes(1);
    expect(feedback.fail).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();

    release();
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/continue?locale=vi'));
  });

  it('wrong credentials: the card fails, no stamp, no navigation', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), {
        code: 'invalid_credentials',
        status: 400,
      }),
    });
    const { feedback } = feedbackSpy();
    renderInCard(feedback);
    await fill('buyer@vidu.vn', 'sai-mat-khau-1');

    await screen.findByRole('alert');
    expect(feedback.fire).toHaveBeenCalledTimes(1);
    expect(feedback.fail).toHaveBeenCalledTimes(1);
    expect(feedback.fail).toHaveBeenCalledWith();
    expect(feedback.seal).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('client validation failure: fail only, nothing is fired or sent', async () => {
    const { feedback } = feedbackSpy();
    renderInCard(feedback);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await screen.findByText('Nhập email của bạn.');
    expect(feedback.fail).toHaveBeenCalledTimes(1);
    expect(feedback.fail).toHaveBeenCalledWith('invalid');
    expect(feedback.fire).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('a thrown error also fails the card', async () => {
    signInWithPassword.mockRejectedValue(new Error('network'));
    const { feedback } = feedbackSpy();
    renderInCard(feedback);
    await fill('buyer@vidu.vn', 'matkhau2026');
    await screen.findByRole('alert');
    expect(feedback.fail).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('SignInForm accessibility after an error', () => {
  it('puts the focus back on the submit button once the form is idle again', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), {
        code: 'invalid_credentials',
        status: 400,
      }),
    });
    renderVi(<SignInForm next={null} />);
    await fill('buyer@vidu.vn', 'sai-mat-khau-1');
    await screen.findByRole('alert');
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đăng nhập' })),
    );
  });

  it('gives the standalone links a 44px target', () => {
    renderVi(<SignInForm next={null} />);
    for (const name of ['Quên mật khẩu?', 'Hộ làng nghề? Đăng ký tham gia triển lãm']) {
      expect(screen.getByRole('link', { name }).className).toContain('min-h-11');
    }
  });
});
