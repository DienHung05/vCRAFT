'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  CatalogPagination,
  type CatalogPaginationProps,
} from '@/features/catalog/catalog-pagination';

/** `?page=N` on the current URL, keeping the other query parameters; page 1 drops the parameter. */
export function pageHref(pathname: string, search: string, page: number): string {
  const query = new URLSearchParams(search);
  if (page > 1) query.set('page', String(page));
  else query.delete('page');
  const rest = query.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}

/**
 * The catalog's numbered page bar for server-rendered lists (households, news; GH#202): every page is a real
 * `?page=N` URL rendered on the server, and a plain click navigates there without a full reload.
 */
export function UrlPagination(props: Omit<CatalogPaginationProps, 'hrefFor' | 'onNavigate'>) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const hrefFor = (page: number) => pageHref(pathname, search, page);
  return (
    <CatalogPagination
      {...props}
      hrefFor={hrefFor}
      onNavigate={(page) => router.push(hrefFor(page))}
    />
  );
}
