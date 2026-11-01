'use client';

import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const ITEMS = [
  { key: 'home', href: '/studio' },
  { key: 'products', href: '/studio/san-pham' },
  { key: 'quotations', href: '/studio/bao-gia' },
  { key: 'orders', href: '/studio/don-hang' },
  { key: 'profile', href: '/studio/ho-so' },
] as const;

/**
 * Điều hướng Studio (FR-ART), ưu tiên điện thoại: thanh dưới đáy màn hình trên màn hẹp, hàng ngang
 * đầu nội dung trên màn rộng.
 */
export function StudioNav() {
  const t = useTranslations('studio.nav');
  const pathname = usePathname();
  const itemClass =
    'flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-input px-1 text-center text-small leading-tight md:flex-none md:px-3 md:whitespace-nowrap';
  return (
    <nav
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-30 border-ink/10 border-t bg-paper/95 backdrop-blur-md md:static md:mx-auto md:max-w-editorial md:border-t-0 md:border-b md:bg-transparent md:px-gutter md:pt-4"
    >
      <ul className="flex gap-1 p-1 md:p-0 md:pb-2">
        {ITEMS.map(({ key, href }) => (
          <li key={key} className="flex min-w-0 flex-1 md:flex-none">
            <Link
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
              className={cn(
                itemClass,
                pathname === href
                  ? 'bg-clay/12 font-medium text-clay-ink'
                  : 'text-ink/80 hover:bg-ink/6',
              )}
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
