import { Logo } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { SessionUnavailable } from '@/components/session-unavailable';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { AdminNav } from '@/features/admin/admin-nav';
import { AccountMenu } from '@/features/auth/account-menu';
import { AdminMfaGate } from '@/features/auth/admin-mfa-gate';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { Link } from '@/i18n/navigation';
import { requireArea } from '@/lib/auth/guard';
import { resolveLocale } from '@/lib/locale';

/** Khung Admin (BRAND §9): sạch, mật độ cao, nền giấy; sidebar bên trái, thu thành hàng ngang trên màn hẹp. */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]/admin'>) {
  const locale = await resolveLocale(params);
  const viewer = await requireArea('admin', locale);
  const t = await getTranslations('admin');

  // The API could not confirm the session: show a retry inside the admin frame instead of a 500 page.
  if (!viewer) {
    return (
      <main id="main" className="min-h-svh px-4 py-6 md:px-8">
        <Link href="/" aria-label={t('home')}>
          <Logo size={26} />
        </Link>
        <SessionUnavailable />
      </main>
    );
  }

  // GH#83: until this session passes TOTP the API refuses every admin route, so show the code screen
  // instead of pages that would only fail.
  if (viewer.mfaRequired) {
    return (
      <main id="main" className="min-h-svh px-4 py-6 md:px-8">
        <Link href="/" aria-label={t('home')}>
          <Logo size={26} />
        </Link>
        <AdminMfaGate />
      </main>
    );
  }

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[14rem_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-input focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {(await getTranslations('common'))('skip')}
      </a>
      <aside className="border-ink/10 border-b bg-surface lg:sticky lg:top-0 lg:h-svh lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-start lg:gap-5 lg:py-5">
          <Link href="/" aria-label={t('home')}>
            <Logo size={26} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-chip bg-glaze/10 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-glaze uppercase">
              {t('badge')}
            </span>
            {/* Dưới lg thanh bên thu thành hàng ngang nên đổi ngôn ngữ nằm ở đây (bản lg ở cuối thanh bên). */}
            <div className="lg:hidden">
              <LocaleSwitcher />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-4 pb-2 lg:pb-3">
          {/* The account takes the remaining width and truncates its email; the bell keeps its own column. */}
          <div className="min-w-0 flex-1">
            <AccountMenu align="start" />
          </div>
          <div className="shrink-0">
            <NotificationBell align="start" />
          </div>
        </div>
        <div className="px-2 pb-2 lg:px-3">
          <AdminNav />
        </div>
        <div className="hidden px-4 py-4 lg:block">
          <LocaleSwitcher />
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
