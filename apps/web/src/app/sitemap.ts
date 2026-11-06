import type { MetadataRoute } from 'next';
import { fetchHouseholds, fetchProducts } from '@/features/catalog/exhibition-api';
import { fetchNews } from '@/features/news/news-api';
import { type SitemapPage, STATIC_PAGES, sitemapEntries } from '@/lib/seo/sitemap-entries';
import { siteOrigin } from '@/lib/site';

// Built on request (the API may be down at build time) and cached for an hour.
export const revalidate = 3600;

// Stops a runaway cursor loop; 50 pages of 100 is far beyond the village's catalogue.
const MAX_PAGES = 50;

async function productPages(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const result = await fetchProducts({ limit: 100, ...(cursor ? { cursor } : {}) });
    if (result.status !== 'ok') break;
    for (const p of result.data.data) {
      pages.push({
        href: { pathname: '/san-pham/[slug]', params: { slug: p.slug } },
        lastModified: p.publishedAt,
      });
    }
    if (!result.data.nextCursor) break;
    cursor = result.data.nextCursor;
  }
  return pages;
}

async function householdPages(): Promise<SitemapPage[]> {
  const result = await fetchHouseholds();
  if (result.status !== 'ok') return [];
  return result.data.data.map((h) => ({
    href: { pathname: '/nghe-nhan/[slug]', params: { slug: h.slug } },
  }));
}

async function newsPages(): Promise<SitemapPage[]> {
  const pages: SitemapPage[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const result = await fetchNews({ limit: 100, cursor });
    if (result.status !== 'ok') break;
    for (const n of result.page.data) {
      pages.push({
        href: { pathname: '/tin-tuc/[slug]', params: { slug: n.slug } },
        lastModified: n.publishedAt,
      });
    }
    if (!result.page.nextCursor) break;
    cursor = result.page.nextCursor;
  }
  return pages;
}

/** `/sitemap.xml`: public pages, households, products and news in vi and en (PLAN S6). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, households, news] = await Promise.all([
    productPages(),
    householdPages(),
    newsPages(),
  ]);
  // If the API is down the static pages are still listed.
  return sitemapEntries(siteOrigin(), [...STATIC_PAGES, ...households, ...products, ...news]);
}
