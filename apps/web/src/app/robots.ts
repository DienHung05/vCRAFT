import { locales } from '@vcraft/i18n';
import type { MetadataRoute } from 'next';
import { localizedPath } from '@/lib/seo/sitemap-entries';
import { siteOrigin } from '@/lib/site';

// Signed-in areas in every locale's spelling: Studio, Admin, the account page and the buyer's
// quotation requests, plus the auth callbacks.
const PRIVATE = ['/studio', '/admin', '/tai-khoan', '/yeu-cau-bao-gia', '/yeu-thich'] as const;

export function disallowedPaths(): string[] {
  const localized = locales.flatMap((locale) => PRIVATE.map((href) => localizedPath(href, locale)));
  return [...new Set([...localized, '/auth/'])];
}

/** `/robots.txt` (PLAN S6). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: disallowedPaths() },
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
