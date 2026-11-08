import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type AdminClient, ApiError } from '@vcraft/api-client';
import type { AdminUserDto, InvitationDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AdminAccounts } from '@/features/admin/admin-accounts';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ADMIN_ID = '123e4567-e89b-12d3-a456-426614174001';
const BUYER_ID = '123e4567-e89b-12d3-a456-426614174002';
const LOCKED_ID = '123e4567-e89b-12d3-a456-426614174003';

const user = (over: Partial<AdminUserDto>): AdminUserDto => ({
  id: BUYER_ID,
  email: 'lan@example.com',
  username: 'lan',
  fullName: 'Lan Nguyen',
  role: 'BUYER',
  status: 'ACTIVE',
  statusReason: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...over,
});

const LOCKED = user({
  id: LOCKED_ID,
  email: 'mai@example.com',
  fullName: 'Mai Tran',
  status: 'LOCKED',
  statusReason: 'Spam listings',
});

const INVITATION: InvitationDto = {
  id: '123e4567-e89b-12d3-a456-426614174009',
  email: 'ops@example.com',
  role: 'ADMIN',
  status: 'PENDING',
  invitedByName: 'Board Admin',
  createdAt: '2026-11-02T00:00:00.000Z',
  acceptedAt: null,
};

function fakeClient(over: Record<string, unknown> = {}) {
  return {
    listUsers: vi.fn().mockResolvedValue({ items: [user({}), LOCKED] }),
    listInvitations: vi.fn().mockResolvedValue({ items: [INVITATION] }),
    suspendUser: vi.fn(),
    unsuspendUser: vi.fn(),
    inviteAccount: vi.fn(),
    ...over,
  };
}
const asClient = (methods: object) => methods as unknown as AdminClient;

describe('Admin accounts: invitations (FR-AUTH-03)', () => {
  it('lists the invitations sent so far', async () => {
    renderVi(<AdminAccounts client={asClient(fakeClient())} />);
    const list = await screen.findByTestId('invitations');
    expect(within(list).getByText('ops@example.com')).toBeTruthy();
    expect(within(list).getByText('Đang chờ')).toBeTruthy();
    expect(within(list).getByText(/Mời bởi Board Admin/)).toBeTruthy();
  });

  it('rejects a malformed email without calling the API', async () => {
    const client = fakeClient();
    renderVi(<AdminAccounts client={asClient(client)} />);
    fireEvent.change(await screen.findByLabelText('Email người được mời'), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Hãy nhập một địa chỉ email hợp lệ.',
    );
    expect(client.inviteAccount).not.toHaveBeenCalled();
  });

  it('sends the invitation with a lowercased email and the chosen role, and reloads the list', async () => {
    const client = fakeClient({ inviteAccount: vi.fn().mockResolvedValue(INVITATION) });
    renderVi(<AdminAccounts client={asClient(client)} />);
    fireEvent.change(await screen.findByLabelText('Email người được mời'), {
      target: { value: ' New.Admin@Example.com ' },
    });
    fireEvent.change(screen.getAllByLabelText('Vai trò')[0] as HTMLElement, {
      target: { value: 'HOUSEHOLD' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi lời mời' }));
    await waitFor(() =>
      expect(client.inviteAccount).toHaveBeenCalledWith({
        email: 'new.admin@example.com',
        role: 'HOUSEHOLD',
      }),
    );
    expect((await screen.findByRole('status')).textContent).toBe(
      'Đã gửi lời mời tới new.admin@example.com.',
    );
    await waitFor(() => expect(client.listInvitations).toHaveBeenCalledTimes(2));
  });

  it('warns that a new administrator must enrol two-factor authentication', async () => {
    renderVi(<AdminAccounts client={asClient(fakeClient())} />);
    expect(await screen.findByText(/phải bật xác thực hai lớp/)).toBeTruthy();
  });

  it('says plainly when the address already has an account', async () => {
    const client = fakeClient({
      inviteAccount: vi.fn().mockRejectedValue(new ApiError('CONFLICT_DUPLICATE', 409)),
    });
    renderEn(<AdminAccounts client={asClient(client)} />);
    fireEvent.change(await screen.findByLabelText('Email of the person to invite'), {
      target: { value: 'taken@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This email already has an account.',
    );
  });
});

describe('Admin accounts: suspension (FR-AUTH-10)', () => {
  it('shows each account with its status and the reason of a suspension', async () => {
    renderVi(<AdminAccounts client={asClient(fakeClient())} />);
    const list = await screen.findByTestId('users');
    expect(within(list).getByText('Lan Nguyen')).toBeTruthy();
    expect(within(list).getByText('Đã tạm khóa')).toBeTruthy();
    expect(within(list).getByText('Lý do: Spam listings')).toBeTruthy();
  });

  it('needs a reason of at least 3 characters, then suspends and shows the account as locked', async () => {
    const suspended = user({ status: 'LOCKED', statusReason: 'Fake reviews' });
    const client = fakeClient({ suspendUser: vi.fn().mockResolvedValue(suspended) });
    renderVi(<AdminAccounts client={asClient(client)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm khóa: Lan Nguyen' }));
    const confirm = screen.getAllByRole('button', { name: 'Tạm khóa' }).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do (ít nhất 3 ký tự)'), { target: { value: 'ab' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do (ít nhất 3 ký tự)'), {
      target: { value: '  Fake reviews ' },
    });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await waitFor(() => expect(client.suspendUser).toHaveBeenCalledWith(BUYER_ID, 'Fake reviews'));
    expect(await screen.findByText('Lý do: Fake reviews')).toBeTruthy();
  });

  it('restores a suspended account after confirming', async () => {
    const client = fakeClient({
      unsuspendUser: vi.fn().mockResolvedValue({ ...LOCKED, status: 'ACTIVE', statusReason: null }),
    });
    renderVi(<AdminAccounts client={asClient(client)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở khóa: Mai Tran' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mở khóa' }).at(-1) as HTMLElement);
    await waitFor(() => expect(client.unsuspendUser).toHaveBeenCalledWith(LOCKED_ID));
    await waitFor(() => expect(screen.queryByText('Lý do: Spam listings')).toBeNull());
  });

  it('explains that an administrator cannot suspend their own account', async () => {
    const client = fakeClient({
      listUsers: vi.fn().mockResolvedValue({ items: [user({ id: ADMIN_ID, role: 'ADMIN' })] }),
      suspendUser: vi.fn().mockRejectedValue(new ApiError('BUSINESS_RULE_VIOLATED', 409)),
    });
    renderVi(<AdminAccounts client={asClient(client)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm khóa: Lan Nguyen' }));
    fireEvent.change(screen.getByLabelText('Lý do (ít nhất 3 ký tự)'), {
      target: { value: 'testing' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạm khóa' }).at(-1) as HTMLElement);
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Bạn không thể tự khóa tài khoản của mình.',
    );
  });

  it('filters by role and status through the API', async () => {
    const client = fakeClient();
    renderVi(<AdminAccounts client={asClient(client)} />);
    await screen.findByTestId('users');
    fireEvent.change(screen.getByLabelText('Trạng thái', { selector: 'select' }), {
      target: { value: 'LOCKED' },
    });
    await waitFor(() => expect(client.listUsers).toHaveBeenLastCalledWith({ status: 'LOCKED' }));
    fireEvent.change(screen.getByLabelText('Tìm theo email, tên hoặc tên đăng nhập'), {
      target: { value: 'mai' },
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Lọc người dùng' }));
    await waitFor(() =>
      expect(client.listUsers).toHaveBeenLastCalledWith({ status: 'LOCKED', q: 'mai' }),
    );
  });
});
