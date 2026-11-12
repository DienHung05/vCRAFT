import { screen } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderRoleProvider } from '@/components/shell/header-role';
import { RoleNavLinks } from '@/components/shell/role-nav-links';
import { quotationTab } from '@/lib/auth/quotation-tab';
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

const STUDIO_QUOTATIONS_HREF = '/studio/bao-gia';

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

  // GH#490: the Studio tab already answers invitations at /studio/bao-gia, so the header must not repeat it.
  it('sends a household to the open requests, a different destination from the Studio tab', async () => {
    account = signedIn('HOUSEHOLD');
    renderVi(
      <HeaderRoleProvider>
        <RoleNavLinks items={ITEMS} />
      </HeaderRoleProvider>,
    );
    const link = quotationLink('Yêu cầu đang mở');
    expect(link.getAttribute('href')).toBe('/studio/yeu-cau-mo');
    // No second "Lời mời báo giá" and no old buyer link in the header.
    expect(screen.queryByText('Lời mời báo giá')).toBeNull();
    expect(screen.queryByText('Yêu cầu báo giá')).toBeNull();
    expect(link.textContent).toBe('Yêu cầu đang mở');
    // The header no longer counts invitations, so it does not call the invitations API.
    expect(listInvitations).not.toHaveBeenCalled();
  });

  it('differs from the Studio nav item in both label and href, in vi and en', () => {
    const studio = { vi: messages.vi.studio.nav.quotations, en: messages.en.studio.nav.quotations };
    const header = quotationTab('HOUSEHOLD');
    expect(header.href).not.toBe(STUDIO_QUOTATIONS_HREF);
    expect(messages.vi.nav[header.labelKey]).not.toBe(studio.vi);
    expect(messages.en.nav[header.labelKey]).not.toBe(studio.en);
    expect(messages.vi.nav[header.labelKey]).toBe('Yêu cầu đang mở');
    expect(messages.en.nav[header.labelKey]).toBe('Open requests');
  });

  it('labels the household item in English', () => {
    account = signedIn('HOUSEHOLD');
    renderEn(
      <HeaderRoleProvider>
        <RoleNavLinks items={ITEMS} />
      </HeaderRoleProvider>,
    );
    expect(quotationLink('Open requests').getAttribute('href')).toBe('/studio/yeu-cau-mo');
    expect(screen.queryByText('Quote invitations')).toBeNull();
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
