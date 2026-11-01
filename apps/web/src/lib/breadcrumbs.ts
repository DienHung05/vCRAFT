import type { ComponentProps } from 'react';
import type { Link } from '@/i18n/navigation';

/** Any href the localized `Link` accepts (typed pathnames included). */
export type CrumbHref = ComponentProps<typeof Link>['href'];

export interface BreadcrumbInput {
  label: string;
  /** Omit on the last crumb (the current page) and on non-navigable groups. */
  href?: CrumbHref;
}

export interface Breadcrumb {
  label: string;
  /** Only crumbs before the current page link anywhere. */
  href?: CrumbHref;
  current: boolean;
}

/**
 * Normalizes a trail: drops empty labels, marks exactly the last crumb as the current page and
 * strips its `href` (the current page does not link to itself). A trail of fewer than two crumbs
 * returns `[]` because a lone breadcrumb carries no information.
 */
export function buildBreadcrumbTrail(
  items: readonly (BreadcrumbInput | false | null | undefined)[],
): Breadcrumb[] {
  const kept = items.filter(
    (item): item is BreadcrumbInput => item !== false && Boolean(item?.label?.trim()),
  );
  if (kept.length < 2) return [];
  return kept.map<Breadcrumb>((item, index) => {
    const current = index === kept.length - 1;
    return {
      label: item.label,
      current,
      ...(!current && item.href !== undefined ? { href: item.href } : {}),
    };
  });
}
