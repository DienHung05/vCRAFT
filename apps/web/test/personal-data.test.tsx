import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AccountApiError, type AccountClient } from '@vcraft/api-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersonalDataCard } from '@/features/account/personal-data';
import { confirmDialog, openDialog } from './confirm';
import { renderEn, renderVi } from './render';

const notifySuccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/notify', () => ({
  notify: { success: notifySuccess, error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/i18n/navigation', () => ({ getPathname: () => '/' }));
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => null,
  browserAccountClient: () => {
    throw new Error('not used');
  },
}));

const EMAIL = 'ban@vidu.vn';
const EXPORT = {
  schemaVersion: 1,
  exportedAt: '2026-11-01T08:00:00.000Z',
  policyVersion: '2026-11-01',
  account: {},
};

function api(overrides: Partial<AccountClient> = {}): AccountClient {
  return {
    exportMyData: vi.fn(async () => EXPORT),
    deleteAccount: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as AccountClient;
}

beforeEach(() => {
  notifySuccess.mockReset();
});

describe('PersonalDataCard: download', () => {
  it('downloads the export as a dated JSON file', async () => {
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const clicked: { download: string; href: string }[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ download: this.download, href: this.href });
    });
    const client = api();
    renderVi(<PersonalDataCard email={EMAIL} accountRole="BUYER" client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu của tôi' }));
    await waitFor(() => expect(clicked).toHaveLength(1));
    expect(client.exportMyData).toHaveBeenCalledTimes(1);
    expect(clicked[0]?.download).toBe('vcraft-my-data-2026-11-01.json');
    expect(clicked[0]?.href).toBe('blob:export');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(notifySuccess).toHaveBeenCalledWith('Đã tải xuống tệp dữ liệu của bạn.');
    click.mockRestore();
  });

  it('says so and keeps the button usable when the export fails', async () => {
    const client = api({ exportMyData: vi.fn().mockRejectedValue(new Error('down')) });
    renderEn(<PersonalDataCard email={EMAIL} accountRole="BUYER" client={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download my data' }));
    expect((await screen.findByRole('alert')).textContent).toContain('could not be downloaded');
    expect(
      (screen.getByRole('button', { name: 'Download my data' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe('PersonalDataCard: delete', () => {
  const openDeletion = () =>
    fireEvent.click(screen.getByRole('button', { name: 'Xóa tài khoản của tôi' }));
  const type = (value: string) =>
    fireEvent.change(within(openDialog()).getByLabelText(/Nhập email của tài khoản/), {
      target: { value },
    });
  const confirm = () => confirmDialog('Xóa vĩnh viễn');

  it('needs the typed email before the confirm button works, then deletes and signs out', async () => {
    const client = api();
    const onDeleted = vi.fn();
    renderVi(
      <PersonalDataCard email={EMAIL} accountRole="BUYER" client={client} onDeleted={onDeleted} />,
    );
    openDeletion();
    const button = within(openDialog()).getByRole('button', {
      name: 'Xóa vĩnh viễn',
      hidden: true,
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    type('nguoi-khac@vidu.vn');
    expect(button.disabled).toBe(true);
    type('BAN@vidu.vn');
    expect(button.disabled).toBe(false);
    confirm();
    await waitFor(() => expect(client.deleteAccount).toHaveBeenCalledWith('BAN@vidu.vn'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalledWith('Đã xóa tài khoản của bạn.');
  });

  it('explains why an account with an order in progress cannot be deleted', async () => {
    const client = api({
      deleteAccount: vi
        .fn()
        .mockRejectedValue(new AccountApiError('ACCOUNT_DELETION_ACTIVE_ORDERS', 409)),
    });
    const onDeleted = vi.fn();
    renderVi(
      <PersonalDataCard
        email={EMAIL}
        accountRole="HOUSEHOLD"
        client={client}
        onDeleted={onDeleted}
      />,
    );
    openDeletion();
    type(EMAIL);
    confirm();
    expect(
      (await within(openDialog()).findByRole('alert', { hidden: true })).textContent,
    ).toContain('Bạn còn đơn hàng đang thực hiện');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('shows a generic message when deletion fails, and nothing is signed out', async () => {
    const client = api({ deleteAccount: vi.fn().mockRejectedValue(new Error('boom')) });
    const onDeleted = vi.fn();
    renderVi(
      <PersonalDataCard email={EMAIL} accountRole="BUYER" client={client} onDeleted={onDeleted} />,
    );
    openDeletion();
    type(EMAIL);
    confirm();
    expect(
      (await within(openDialog()).findByRole('alert', { hidden: true })).textContent,
    ).toContain('chưa có gì bị thay đổi');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('does not offer self-service deletion to an administrator', () => {
    renderVi(<PersonalDataCard email={EMAIL} accountRole="ADMIN" client={api()} />);
    expect(screen.queryByRole('button', { name: 'Xóa tài khoản của tôi' })).toBeNull();
    expect(screen.getByText(/Tài khoản quản trị không tự xóa ở đây/)).toBeTruthy();
  });
});
