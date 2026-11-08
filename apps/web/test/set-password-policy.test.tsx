import { fireEvent, screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SetPasswordForm } from '@/features/auth/set-password-form';
import { renderEn, renderVi } from './render';

const { verifyOtp, updateUser } = vi.hoisted(() => ({ verifyOtp: vi.fn(), updateUser: vi.fn() }));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { verifyOtp, updateUser } }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(() => {
  verifyOtp.mockClear();
  updateUser.mockClear();
});

describe.each(['vi', 'en'] as const)('reset password policy in %s', (locale) => {
  const render = locale === 'vi' ? renderVi : renderEn;
  const copy = messages[locale].auth;

  it.each(['Abcdefgh1', 'abcdefghij1', 'ABCDEFGHIJ1', 'Abcdefghijk'])(
    'rejects %s before consuming the recovery token',
    async (password) => {
      render(
        <SetPasswordForm mode="recovery" tokenHash="test-recovery-token" hasSession={false} />,
      );
      fireEvent.change(screen.getByLabelText(copy.fields.newPassword), {
        target: { value: password },
      });
      fireEvent.change(screen.getByLabelText(copy.fields.confirmPassword), {
        target: { value: password },
      });
      fireEvent.click(screen.getByRole('button', { name: copy.reset.submit }));
      expect(
        await screen.findByText(
          password.length < 10 ? copy.validation.passwordShort : copy.validation.passwordWeak,
        ),
      ).toBeTruthy();
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(updateUser).not.toHaveBeenCalled();
    },
  );
});
