'use client';

import { cn } from '@vcraft/ui';
import { TabBrush } from '@/experience/motion/tab-brush';
import { Link, usePathname } from '@/i18n/navigation';

export interface HeaderNavItem {
  href: '/san-pham' | '/nghe-nhan' | '/ban-do' | '/tin-tuc' | '/yeu-cau-bao-gia' | '/yeu-thich';
  label: string;
}

/**
 * Whether `href` is the current section: the exact path or any page below it (`/san-pham/[slug]`
 * belongs to `/san-pham`). `pathname` is next-intl's internal key without locale prefix, so the same
 * check serves `/vi/san-pham` and `/en/products`. The home page matches no item.
 */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Items of the main navigation with the current section marked (`aria-current="page"`). The header
 * stays a server component and passes the translated items in. With `brush`, the desktop bar also
 * draws the sliding underline; its parent `<nav>` must be `position: relative`. The menu variant
 * underlines the active item statically.
 */
export function HeaderNavLinks({
  items,
  brush = false,
}: {
  items: HeaderNavItem[];
  brush?: boolean;
}) {
  const pathname = usePathname();
  return (
    <>
      <ul className={brush ? 'flex items-center gap-1' : undefined}>
        {items.map(({ href, label }) => {
          const active = isNavActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block rounded-input px-3 py-2 text-small whitespace-nowrap transition-colors hover:bg-ink/6 hover:text-ink',
                  active ? 'font-medium text-ink' : 'text-ink/80',
                  // The bar gets the brush; the menu has none, so it underlines the label itself.
                  active && !brush && 'underline decoration-2 decoration-clay underline-offset-4',
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {brush && <TabBrush activeKey={pathname} />}
    </>
  );
}
