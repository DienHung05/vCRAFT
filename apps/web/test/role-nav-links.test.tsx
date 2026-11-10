import { act, screen, waitFor } from '@testing-library/react';
import type { MyInvitationDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderRoleProvider } from '@/components/shell/header-role';
import { RoleNavLinks } from '@/components/shell/role-nav-links';
import type { AccountState } from '@/lib/auth/use-account';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/',
  Link: ({
    href,
    children,
    ...rest
  }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let account: AccountState = { status: 'loading' };
vi.mock('@/lib/auth/use-account', () => ({ useAccount: () => account }));

const listInvitations = vi.fn();
vi.mock('@/lib/api/use-quotation-client', () => ({
  useQuotationClient: () => ({ client: { listInvitations }, loading: false }),
}));

const ITEMS = [
  { href: '/san-pham' as const, label: 'Sản phẩm' },
  { href: '/yeu-cau-bao-gia' as const, label: 'Yêu cầu báo giá' },
  { href: '/yeu-thich' as const, label: 'Yêu thích' },
];

const signedIn = (role: 'BUYER' | 'HOUSEHOLD' | 'ADMIN'): AccountState => ({
  status: 'signed-in',
  email: 'a@b.vn',
  householdIntent: false,
  me: { role } as never,
});

function open(requestId: string, closes: string, declined = false): MyInvitationDto {
  return {
    request: { id: requestId, status: 'SENT', biddingClosesAt: closes },
    contribution: null,
    declined,
  } as unknown as MyInvitationDto;
}

const quotationLink = (name: string) => screen.getByRole('link', { name: new RegExp(name) });

beforeEach(() => {
  account = { status: 'loading' };
  listInvitations.mockReset();
});

describe('RoleNavLinks', () => {
  it('keeps the buyer link for a guest and for a buyer, without calling the invitations API', () => {
    for (const state of [{ status: 'guest' } as AccountState, signedIn('BUYER')]) {
      account = state;
      const { unmount } = renderVi(
        <HeaderRoleProvider>
          <RoleNavLinks items={ITEMS} />
        </HeaderRoleProvider>,
      );
      expect(quotationLink('Yêu cầu báo giá').getAttribute('href')).toBe('/yeu-cau-bao-gia');
      unmount();
    }
    expect(listInvitations).not.toHaveBeenCalled();
  });

  it('sends a household to Studio with a badge of its open invitations', async () => {
    account = signedIn('HOUSEHOLD');
    listInvitations.mockResolvedValue([
      open('1', '2099-01-01T00:00:00.000Z'),
      open('2', '2099-02-01T00:00:00.000Z'),
      open('3', '2099-03-01T00:00:00.000Z', true),
      open('4', '2000-01-01T00:00:00.000Z'),
    ]);
    renderVi(
      <HeaderRoleProvider>
        <RoleNavLinks items={ITEMS} />
      </HeaderRoleProvider>,
    );
    await waitFor(() => expect(screen.getByText('2 lời mời đang mở')).toBeTruthy());
    const link = quotationLink('Lời mời báo giá');
    expect(link.getAttribute('href')).toBe('/studio/bao-gia');
    expect(link.textContent).toContain('2');
    expect(screen.queryByText('Yêu cầu báo giá')).toBeNull();
  });

  it('shows no badge for a household without open invitations, or when loading fails', async () => {
    account = signedIn('HOUSEHOLD');
    listInvitations.mockRejectedValue(new Error('down'));
    renderEn(
      <HeaderRoleProvider>
        <RoleNavLinks items={ITEMS} />
      </HeaderRoleProvider>,
    );
    await act(async () => {});
    const link = quotationLink('Quote invitations');
    expect(link.getAttribute('href')).toBe('/studio/bao-gia');
    expect(link.textContent).toBe('Quote invitations');
  });

  it('sends an administrator to the coordination board', () => {
    account = signedIn('ADMIN');
    renderEn(
      <HeaderRoleProvider>
        <RoleNavLinks items={ITEMS} />
      </HeaderRoleProvider>,
    );
    expect(quotationLink('Coordination').getAttribute('href')).toBe('/admin/dieu-phoi');
    expect(listInvitations).not.toHaveBeenCalled();
  });
});
