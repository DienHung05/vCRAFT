import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerFrame as BuyerLayout } from '@/app/[locale]/(buyer)/layout';
import { AdminFrame as AdminLayout } from '@/app/[locale]/admin/layout';
import { StudioFrame as StudioLayout } from '@/app/[locale]/studio/layout';
import { renderVi } from './render';

const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/lib/locale', () => ({ resolveLocale: vi.fn(async () => 'vi') }));
vi.mock('@/lib/auth/guard', () => ({ requireArea: vi.fn() }));
vi.mock('next-intl/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl/server')>()),
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/components/shell/public-shell', () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/features/studio/studio-nav', () => ({ StudioNav: () => <nav>studio</nav> }));
vi.mock('@/features/studio/outage-banner', () => ({ OutageBanner: () => null }));
vi.mock('@/features/admin/admin-nav', () => ({ AdminNav: () => <nav>admin</nav> }));
vi.mock('@/features/auth/account-menu', () => ({ AccountMenu: () => null }));
vi.mock('@/features/auth/admin-mfa-gate', () => ({ AdminMfaGate: () => null }));
vi.mock('@/features/notifications/notification-bell', () => ({ NotificationBell: () => null }));
vi.mock('@/components/shell/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ refresh }),
}));

const { requireArea } = await import('@/lib/auth/guard');

const ALERT_TITLE = 'Chưa kiểm tra được phiên đăng nhập';

/** The API could not confirm the session: the guard hands back `null` instead of throwing. */
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireArea).mockResolvedValue(null);
});

async function renderLayout(element: Promise<React.ReactElement>): Promise<void> {
  const resolved = await element;
  await act(async () => {
    renderVi(resolved);
  });
}

describe('guarded layouts when the session check is unavailable', () => {
  it.each([
    [
      'studio',
      () => StudioLayout({ children: <p>Trang con</p>, params: Promise.resolve({ locale: 'vi' }) }),
    ],
    [
      'buyer',
      () => BuyerLayout({ children: <p>Trang con</p>, params: Promise.resolve({ locale: 'vi' }) }),
    ],
    [
      'admin',
      () => AdminLayout({ children: <p>Trang con</p>, params: Promise.resolve({ locale: 'vi' }) }),
    ],
  ] as const)(
    '%s renders the inline retry state, not the page and not an error',
    async (_area, build) => {
      await renderLayout(build() as Promise<React.ReactElement>);

      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByRole('heading', { name: ALERT_TITLE })).toBeTruthy();
      expect(screen.queryByText('Trang con')).toBeNull();
    },
  );

  it('offers a retry button that refreshes the route', async () => {
    await renderLayout(
      StudioLayout({
        children: <p>Trang con</p>,
        params: Promise.resolve({ locale: 'vi' }),
      }) as Promise<React.ReactElement>,
    );
    await act(async () => {
      screen.getByRole('button', { name: 'Thử lại' }).click();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
