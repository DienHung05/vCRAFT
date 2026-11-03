import { Logo } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { LazyAccountMenu } from '@/features/auth/account-menu-lazy';
import { SearchBox } from '@/features/catalog/search-box';
import { LazyNotificationBell } from '@/features/notifications/notification-bell-lazy';
import { Link } from '@/i18n/navigation';
import { Disclosure } from './disclosure';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/san-pham', key: 'products' },
  { href: '/nghe-nhan', key: 'artisans' },
  { href: '/ban-do', key: 'map' },
  { href: '/tin-tuc', key: 'news' },
  { href: '/yeu-cau-bao-gia', key: 'quotes' },
] as const;

/** Thanh đầu trang công khai. Trên màn hẹp, menu gói trong `<details>` (chạy cả khi chưa có JS). */
export async function SiteHeader() {
  const [t, catalog] = await Promise.all([getTranslations('nav'), getTranslations('catalog')]);
  const links = NAV.map((item) => (
    <li key={item.key}>
      <Link
        href={item.href}
        className="block rounded-input px-3 py-2 text-small whitespace-nowrap text-ink/80 transition-colors hover:bg-ink/6 hover:text-ink"
      >
        {t(item.key)}
      </Link>
    </li>
  ));

  return (
    <header className="sticky top-0 z-40 border-ink/8 border-b bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-editorial items-center justify-between gap-3 px-gutter sm:gap-4">
        <Link href="/" aria-label={t('home')} className="shrink-0">
          <Logo size={30} />
        </Link>
        <nav aria-label={t('label')} className="hidden lg:block">
          <ul className="flex items-center gap-1">{links}</ul>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Search: inline from xl; a toggle with a popover from md to xl; inside the menu below md. */}
          <div className="hidden xl:block">
            <SearchBox />
          </div>
          <Disclosure
            className="hidden md:block xl:hidden"
            label={catalog('search')}
            summaryClassName="size-9 px-0"
            focusOnOpen="input"
            summary={<SearchIcon />}
          >
            <div className="absolute right-0 mt-2 w-80 rounded-card bg-surface p-3 shadow-warm ring-1 ring-ink/8">
              <SearchBox />
            </div>
          </Disclosure>
          {/* Dưới sm, đổi ngôn ngữ chuyển vào menu để hàng đầu trang vừa màn hình 360px. */}
          <div className="hidden sm:block">
            <LocaleSwitcher />
          </div>
          <ThemeToggle />
          <LazyNotificationBell />
          <LazyAccountMenu compact />
          <Disclosure className="lg:hidden" summary={t('menu')}>
            <nav
              aria-label={t('label')}
              className="absolute right-0 mt-2 w-56 rounded-card bg-surface p-2 shadow-warm ring-1 ring-ink/8"
            >
              <div className="p-1 md:hidden">
                <SearchBox />
              </div>
              <div className="p-1 sm:hidden">
                <LocaleSwitcher />
              </div>
              <ul>{links}</ul>
            </nav>
          </Disclosure>
        </div>
      </div>
    </header>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
