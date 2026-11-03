import { type Locale, locales, pathnames } from '@vcraft/i18n';
import type { MetadataRoute } from 'next';

type Pathname = keyof typeof pathnames;
type Href = Pathname | { pathname: Pathname; params: Record<string, string> };

/**
 * `/<locale><localized path>` for an internal pathname, as next-intl's `getPathname` builds it (prefix
 * `always`). Kept free of `next/navigation` so the sitemap and robots logic run in plain unit tests.
 */
export function localizedPath(href: Href, locale: Locale): string {
  const { pathname, params } = typeof href === 'string' ? { pathname: href, params: {} } : href;
  const entry = pathnames[pathname];
  const template = typeof entry === 'string' ? entry : entry[locale];
  const path = template.replace(/\[(\w+)\]/g, (_, key: string) =>
    encodeURIComponent(params[key] ?? ''),
  );
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

/** One public page; `lastModified` is the newest content date the API exposes for it, if any. */
export interface SitemapPage {
  href: Href;
  lastModified?: string | null | undefined;
}

/**
 * One sitemap entry per locale, each listing every locale's URL as `alternates.languages` (hreflang),
 * so search engines pair `/vi/san-pham/x` with `/en/products/x`.
 */
export function sitemapEntries(origin: string, pages: SitemapPage[]): MetadataRoute.Sitemap {
  return pages.flatMap(({ href, lastModified }) => {
    const urls = Object.fromEntries(
      locales.map((locale) => [locale, `${origin}${localizedPath(href, locale)}`]),
    ) as Record<Locale, string>;
    return locales.map((locale) => ({
      url: urls[locale],
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages: urls },
    }));
  });
}

/** Static public pages (not Studio, Admin, account, sign-in or the buyer's quotation requests). */
export const STATIC_PAGES: SitemapPage[] = [
  { href: '/' },
  { href: '/san-pham' },
  { href: '/nghe-nhan' },
  { href: '/ban-do' },
  { href: '/tin-tuc' },
  { href: '/ghi-nhan-anh' },
  { href: '/chinh-sach-quyen-rieng-tu' },
];
