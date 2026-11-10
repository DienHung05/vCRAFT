import { fireEvent, screen } from '@testing-library/react';
import type { MeDto } from '@vcraft/contracts';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMenu } from '@/features/auth/account-menu';
import { formats } from '@/i18n/formats';
import type { AccountState } from '@/lib/auth/use-account';
import { renderVi } from './render';

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
}));

let pathname = '/vi';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

vi.mock('@/lib/auth/supabase-browser', () => ({ browserSupabase: () => null }));

let account: AccountState = { status: 'loading' };
vi.mock('@/lib/auth/use-account', () => ({ useAccount: () => account }));

function me(overrides: Partial<MeDto>): MeDto {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'a@b.vn',
    username: 'pottery.buyer',
    fullName: null,
    role: 'BUYER',
    status: 'ACTIVE',
    emailVerified: true,
    mfaRequired: false,
    household: null,
    ...overrides,
  };
}

beforeEach(() => {
  pathname = '/vi';
  account = { status: 'loading' };
});

describe('account menu and household registration (GH#180)', () => {
  it('a Buyer who started household registration gets a link back to the wizard', () => {
    account = { status: 'signed-in', email: 'a@b.vn', me: me({}), householdIntent: true };
    renderVi(<AccountMenu />);
    const link = screen.getByRole('link', { name: 'Hoàn tất đăng ký hộ làng nghề', hidden: true });
    expect(link.getAttribute('href')).toBe('/dang-ky-nghe-nhan');
  });

  it('a plain Buyer sees no such link', () => {
    account = { status: 'signed-in', email: 'a@b.vn', me: me({}), householdIntent: false };
    renderVi(<AccountMenu />);
    expect(screen.queryByText('Hoàn tất đăng ký hộ làng nghề')).toBeNull();
  });

  it('a household awaiting review shows the household role and its pending state', () => {
    account = {
      status: 'signed-in',
      email: 'a@b.vn',
      me: me({
        role: 'HOUSEHOLD',
        household: {
          id: '00000000-0000-4000-8000-000000000002',
          name: 'Hộ A',
          slug: 'ho-a',
          status: 'PENDING_REVIEW',
          statusReason: null,
          reviewState: 'NEW',
          resubmittedAt: null,
        },
      }),
      householdIntent: true,
    };
    renderVi(<AccountMenu />);
    expect(screen.getByText('Người đại diện hộ')).toBeTruthy();
    expect(screen.queryByText('Khách')).toBeNull();
    expect(screen.getByText('Hồ sơ hộ đang chờ Ban quản lý duyệt')).toBeTruthy();
    expect(screen.queryByText('Hoàn tất đăng ký hộ làng nghề')).toBeNull();
  });
});

describe('account menu closing (GH#432)', () => {
  const open = (container: HTMLElement) => {
    const details = container.querySelector('details') as HTMLDetailsElement;
    details.open = true;
    return details;
  };

  it('closes when the workspace link is clicked', () => {
    account = { status: 'signed-in', email: 'a@b.vn', me: me({}), householdIntent: false };
    const { container } = renderVi(<AccountMenu />);
    const details = open(container);
    fireEvent.click(screen.getByRole('link', { name: 'Yêu cầu báo giá của tôi', hidden: true }));
    expect(details.open).toBe(false);
  });

  it('closes when the finish-registration link is clicked', () => {
    account = { status: 'signed-in', email: 'a@b.vn', me: me({}), householdIntent: true };
    const { container } = renderVi(<AccountMenu />);
    const details = open(container);
    fireEvent.click(
      screen.getByRole('link', { name: 'Hoàn tất đăng ký hộ làng nghề', hidden: true }),
    );
    expect(details.open).toBe(false);
  });

  it('closes when the pathname changes', () => {
    account = { status: 'signed-in', email: 'a@b.vn', me: me({}), householdIntent: false };
    const { container, rerender } = renderVi(<AccountMenu />);
    const details = open(container);
    pathname = '/vi/tai-khoan';
    rerender(
      <NextIntlClientProvider locale="vi" messages={messages.vi} formats={formats}>
        <AccountMenu />
      </NextIntlClientProvider>,
    );
    expect(details.open).toBe(false);
  });
});
