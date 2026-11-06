import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AccountClient } from '@vcraft/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from '@/features/account/change-password-form';
import { EmailPreferencesForm } from '@/features/account/email-preferences-form';
import { renderVi } from './render';

const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));

const signInWithPassword = vi.fn();
const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => ({ auth: { signInWithPassword, updateUser, signOut } }),
  browserAccountClient: () => {
    throw new Error('not used');
  },
}));

beforeEach(() => {
  signInWithPassword.mockReset().mockResolvedValue({ error: null });
  updateUser.mockReset().mockResolvedValue({ error: null });
  signOut.mockReset().mockResolvedValue({ error: null });
  notifySuccess.mockReset();
});

function fillPasswords(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText('Mật khẩu hiện tại'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Nhập lại mật khẩu mới'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
}

describe('ChangePasswordForm', () => {
  it('verifies the current password, updates it, then signs the other devices out', async () => {
    renderVi(<ChangePasswordForm email="ban@vidu.vn" />);
    fillPasswords('mat-khau-cu-1', 'mat-khau-moi-2');
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        expect.stringContaining('Các thiết bị khác đã được đăng xuất'),
      ),
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'ban@vidu.vn',
      password: 'mat-khau-cu-1',
      options: {},
    });
    expect(updateUser).toHaveBeenCalledWith({ password: 'mat-khau-moi-2' });
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(signInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      updateUser.mock.invocationCallOrder[0] ?? 0,
    );
    expect(updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('reports a wrong current password without changing anything', async () => {
    signInWithPassword.mockResolvedValue({
      error: Object.assign(new Error('Invalid login credentials'), {
        code: 'invalid_credentials',
        status: 400,
      }),
    });
    renderVi(<ChangePasswordForm email="ban@vidu.vn" />);
    fillPasswords('sai-mat-khau-1', 'mat-khau-moi-2');
    expect((await screen.findByRole('alert')).textContent).toContain('Mật khẩu hiện tại chưa đúng');
    expect(updateUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('explains a rejected new password and does not sign other devices out', async () => {
    updateUser.mockResolvedValue({
      error: Object.assign(new Error('same'), { code: 'same_password', status: 422 }),
    });
    renderVi(<ChangePasswordForm email="ban@vidu.vn" />);
    fillPasswords('mat-khau-cu-1', 'mat-khau-cu-1');
    expect((await screen.findByRole('alert')).textContent).toContain(
      'phải khác mật khẩu đang dùng',
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it('validates the new password before calling Supabase', async () => {
    renderVi(<ChangePasswordForm email="ban@vidu.vn" />);
    fillPasswords('mat-khau-cu-1', 'ngan1');
    expect(await screen.findByText('Mật khẩu cần ít nhất 8 ký tự.')).toBeTruthy();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('EmailPreferencesForm', () => {
  const prefs = {
    data: [
      { type: 'RFQ_INVITED', email: true },
      { type: 'ALLOCATION_PROPOSED', email: false },
    ],
  };

  it('lists the types from the API grouped by topic, then saves the toggles', async () => {
    const saveNotificationPreferences = vi.fn().mockResolvedValue({
      data: [
        { type: 'RFQ_INVITED', email: false },
        { type: 'ALLOCATION_PROPOSED', email: false },
      ],
    });
    const client = {
      notificationPreferences: vi.fn().mockResolvedValue(prefs),
      saveNotificationPreferences,
    } as unknown as AccountClient;
    renderVi(<EmailPreferencesForm client={client} />);

    const invited = await screen.findByLabelText('Bạn được mời tham gia một yêu cầu báo giá.');
    expect((invited as HTMLInputElement).checked).toBe(true);
    expect(
      (screen.getByLabelText('Bạn có phần sản xuất cần xác nhận.') as HTMLInputElement).checked,
    ).toBe(false);
    expect(screen.getByRole('group', { name: 'Yêu cầu và chào giá' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Phân bổ và đơn hàng' })).toBeTruthy();

    fireEvent.click(invited);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }));
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(expect.stringContaining('Đã lưu')),
    );
    expect(saveNotificationPreferences).toHaveBeenCalledWith({
      preferences: [
        { type: 'RFQ_INVITED', email: false },
        { type: 'ALLOCATION_PROPOSED', email: false },
      ],
    });
  });

  it('says so when the choices cannot be loaded or saved', async () => {
    const failing = {
      notificationPreferences: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as AccountClient;
    const { unmount } = renderVi(<EmailPreferencesForm client={failing} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không tải được');
    unmount();

    const client = {
      notificationPreferences: vi.fn().mockResolvedValue(prefs),
      saveNotificationPreferences: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as AccountClient;
    renderVi(<EmailPreferencesForm client={client} />);
    await screen.findByLabelText('Bạn được mời tham gia một yêu cầu báo giá.');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Chưa lưu được lựa chọn'),
    );
  });
});
