import { Logo } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';

const NAV = [
  { href: '/san-pham', key: 'products' },
  { href: '/nghe-nhan', key: 'artisans' },
  { href: '/ban-do', key: 'map' },
  { href: '/tin-tuc', key: 'news' },
  { href: '/yeu-cau-bao-gia', key: 'quotes' },
] as const;

/** Thanh đầu trang công khai. Trên màn hẹp, menu gói trong `<details>` (chạy cả khi chưa có JS). */
export async function SiteHeader() {
  const t = await getTranslations('nav');
  const links = NAV.map((item) => (
    <li key={item.key}>
      <Link
        href={item.href}
        className="block rounded-input px-3 py-2 text-small text-ink/80 transition-colors hover:bg-ink/6 hover:text-ink"
      >
        {t(item.key)}
      </Link>
    </li>
  ));

  return (
    <header className="sticky top-0 z-40 border-ink/8 border-b bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-editorial items-center justify-between gap-6 px-gutter">
        <Link href="/" aria-label={t('home')} className="shrink-0">
          <Logo size={30} />
        </Link>
        <nav aria-label={t('label')} className="hidden lg:block">
          <ul className="flex items-center gap-1">{links}</ul>
        </nav>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <details className="group relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-input px-3 py-2 text-small text-ink hover:bg-ink/6 [&::-webkit-details-marker]:hidden">
              {t('menu')}
            </summary>
            <nav
              aria-label={t('label')}
              className="absolute right-0 mt-2 w-56 rounded-card bg-surface p-2 shadow-warm ring-1 ring-ink/8"
            >
              <ul>{links}</ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
