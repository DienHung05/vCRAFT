import { Logo } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/shell/locale-switcher';
import { AdminNav } from '@/features/admin/admin-nav';
import { Link } from '@/i18n/navigation';
import { demoParams } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

/** Khung Admin (BRAND §9): sạch, mật độ cao, nền giấy; sidebar bên trái, thu thành hàng ngang trên màn hẹp. */
export default async function AdminLayout({ children, params }: LayoutProps<'/[locale]/admin'>) {
  await resolveLocale(params);
  const t = await getTranslations('admin');
  const first = demoParams.coordinations[0];

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
          <span className="rounded-chip bg-glaze/10 px-2 py-0.5 text-[0.7rem] font-medium tracking-wide text-glaze uppercase">
            {t('badge')}
          </span>
        </div>
        <div className="px-2 pb-2 lg:px-3">
          {first ? <AdminNav coordinationCode={first} /> : null}
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
