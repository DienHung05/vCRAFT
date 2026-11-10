'use client';

import { cn } from '@vcraft/ui';
import { TabBrush } from '@/experience/motion/tab-brush';
import { Link, usePathname } from '@/i18n/navigation';

export interface HeaderNavItem {
  href:
    | '/san-pham'
    | '/nghe-nhan'
    | '/ban-do'
    | '/tin-tuc'
    | '/yeu-cau-bao-gia'
    | '/studio/bao-gia'
    | '/admin/dieu-phoi'
    | '/yeu-thich';
  label: string;
  /** A count next to the label (open invitations); `label` is the screen-reader text for it. */
  badge?: { count: number; label: string } | undefined;
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
        {items.map(({ href, label, badge }) => {
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
                {badge ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="ml-1.5 inline-block min-w-5 rounded-full bg-clay px-1.5 text-center text-xs font-medium text-paper"
                    >
                      {badge.count}
                    </span>
                    <span className="sr-only">{badge.label}</span>
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {brush && <TabBrush activeKey={pathname} />}
    </>
  );
}
