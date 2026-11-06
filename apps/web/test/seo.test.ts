import { describe, expect, it } from 'vitest';
import { disallowedPaths } from '@/app/robots';
import { STATIC_PAGES, sitemapEntries } from '@/lib/seo/sitemap-entries';

describe('sitemapEntries', () => {
  it('lists each page once per locale with hreflang alternates', () => {
    const entries = sitemapEntries('https://vcraft.test', [
      {
        href: { pathname: '/san-pham/[slug]', params: { slug: 'binh-hut-loc' } },
        lastModified: '2026-10-01T00:00:00.000Z',
      },
    ]);
    const languages = {
      vi: 'https://vcraft.test/vi/san-pham/binh-hut-loc',
      en: 'https://vcraft.test/en/products/binh-hut-loc',
    };
    expect(entries).toEqual([
      { url: languages.vi, lastModified: '2026-10-01T00:00:00.000Z', alternates: { languages } },
      { url: languages.en, lastModified: '2026-10-01T00:00:00.000Z', alternates: { languages } },
    ]);
  });

  it('keeps private areas out of the static pages', () => {
    const urls = sitemapEntries('https://vcraft.test', STATIC_PAGES).map((e) => e.url);
    expect(urls).toContain('https://vcraft.test/en/privacy-policy');
    expect(urls.some((u) => /studio|admin|tai-khoan|account|yeu-cau-bao-gia|quotes/.test(u))).toBe(
      false,
    );
  });
});

describe('robots', () => {
  it('disallows Studio, Admin, account and quotation pages in both spellings', () => {
    expect(disallowedPaths()).toEqual(
      expect.arrayContaining([
        '/vi/studio',
        '/en/studio',
        '/vi/admin',
        '/en/admin',
        '/vi/tai-khoan',
        '/en/account',
        '/vi/yeu-cau-bao-gia',
        '/en/quotes',
        '/auth/',
      ]),
    );
  });
});
