import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AccountClient } from '@vcraft/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountSecurity } from '@/features/account/account-security';
import { AdminMfaGate } from '@/features/auth/admin-mfa-gate';
import { renderVi } from './render';

const mfa = {
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challengeAndVerify: vi.fn(),
};
const signOut = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { mfa, signOut } }),
  browserAccountClient: () => ({}),
}));

const reload = vi.fn();
const assign = vi.fn();

beforeEach(() => {
  for (const fn of [...Object.values(mfa), signOut, reload, assign]) fn.mockReset();
  vi.stubGlobal('location', { ...window.location, reload, assign });
});

describe('AdminMfaGate (GH#83)', () => {
  it('enrols a new TOTP factor with a QR code, then verifies the code and reloads', async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [], all: [] }, error: null });
    mfa.enroll.mockResolvedValue({
      data: { id: 'f1', totp: { qr_code: 'data:image/svg+xml;utf8,<svg/>', secret: 'ABC123' } },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    renderVi(<AdminMfaGate />);
    expect(await screen.findByRole('heading', { name: 'Bật xác thực hai lớp' })).toBeTruthy();
    expect(screen.getByText('ABC123')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '123 456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() =>
      expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' }),
    );
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('asks only for the code when a factor is already verified, and explains a wrong code', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f9' }], all: [{ id: 'f9', factor_type: 'totp', status: 'verified' }] },
      error: null,
    });
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: new Error('Invalid TOTP code') });
    renderVi(<AdminMfaGate />);
    expect(await screen.findByRole('heading', { name: 'Nhập mã xác thực' })).toBeTruthy();
    expect(mfa.enroll).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Mã chưa đúng');
    expect(reload).not.toHaveBeenCalled();
  });

  it('removes a stale unverified factor before enrolling again', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [], all: [{ id: 'old', factor_type: 'totp', status: 'unverified' }] },
      error: null,
    });
    mfa.enroll.mockResolvedValue({
      data: { id: 'f2', totp: { qr_code: 'data:,', secret: 'S' } },
      error: null,
    });
    renderVi(<AdminMfaGate />);
    await screen.findByRole('heading', { name: 'Bật xác thực hai lớp' });
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'old' });
  });

  it('refuses a code that is not six digits without calling Supabase', async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'f9' }], all: [] }, error: null });
    renderVi(<AdminMfaGate />);
    await screen.findByRole('heading', { name: 'Nhập mã xác thực' });
    fireEvent.change(screen.getByLabelText('Mã 6 số'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});

describe('AccountSecurity (GH#83)', () => {
  const client = (items: unknown[]) =>
    ({ loginEvents: vi.fn().mockResolvedValue({ items }) }) as unknown as AccountClient;

  it('lists recent sign-ins with their method and second factor', async () => {
    renderVi(
      <AccountSecurity
        client={client([
          { id: 'a', method: 'oauth', aal: 'aal1', createdAt: '2026-11-03T02:00:00.000Z' },
          { id: 'b', method: 'password', aal: 'aal2', createdAt: '2026-11-02T02:00:00.000Z' },
        ])}
      />,
    );
    expect(await screen.findByText('Google')).toBeTruthy();
    expect(screen.getByText(/Mật khẩu · đã xác thực hai lớp/)).toBeTruthy();
  });

  it('signs out of every device after confirming', async () => {
    signOut.mockResolvedValue({ error: null });
    renderVi(<AccountSecurity client={client([])} />);
    expect(await screen.findByText('Chưa có lần đăng nhập nào được ghi lại.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất khỏi mọi thiết bị' }));
    const buttons = screen.getAllByRole('button', { name: 'Đăng xuất khỏi mọi thiết bị' });
    fireEvent.click(buttons.at(-1) as HTMLElement);
    await waitFor(() => expect(signOut).toHaveBeenCalledWith({ scope: 'global' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/vi'));
  });
});
