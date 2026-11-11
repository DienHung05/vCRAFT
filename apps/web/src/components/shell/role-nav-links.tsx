'use client';

import { useTranslations } from 'next-intl';
import { quotationTab } from '@/lib/auth/quotation-tab';
import { type HeaderNavItem, HeaderNavLinks } from './header-nav-links';
import { useHeaderRole } from './header-role';

/** The quotation tab href the server renders for everybody; the viewer's role may swap it. */
export const DEFAULT_QUOTATION_HREF = '/yeu-cau-bao-gia';

/**
 * `HeaderNavLinks` whose quotation tab follows the viewer's role (guest/buyer: buyer area,
 * household: the open requests in Studio, admin: coordination).
 */
export function RoleNavLinks({
  items,
  brush = false,
}: {
  items: HeaderNavItem[];
  brush?: boolean;
}) {
  const t = useTranslations('nav');
  const { role } = useHeaderRole();
  const { href, labelKey } = quotationTab(role);
  const resolved: HeaderNavItem[] = items.map((item) =>
    item.href !== DEFAULT_QUOTATION_HREF ? item : { href, label: t(labelKey) },
  );
  return <HeaderNavLinks items={resolved} brush={brush} />;
}
