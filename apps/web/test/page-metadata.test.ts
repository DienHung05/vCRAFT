import { describe, expect, it } from 'vitest';
import { jsonLd, metaDescription, pageMetadata } from '@/lib/seo/page-metadata';

describe('page metadata (GH#256)', () => {
  it('gives a product page its canonical URL, hreflang alternates and its own share title', () => {
    const meta = pageMetadata({
      locale: 'en',
      href: { pathname: '/san-pham/[slug]', params: { slug: 'binh-men-lam' } },
      title: 'Blue glaze vase',
      description: 'Hand painted.',
    });
    expect(meta.alternates).toEqual({
      canonical: '/en/products/binh-men-lam',
      languages: {
        vi: '/vi/san-pham/binh-men-lam',
        en: '/en/products/binh-men-lam',
        'x-default': '/vi/san-pham/binh-men-lam',
      },
    });
    expect(meta.openGraph).toMatchObject({
      title: 'Blue glaze vase',
      description: 'Hand painted.',
      url: '/en/products/binh-men-lam',
      locale: 'en_US',
      siteName: 'vCraft',
    });
    expect(meta.twitter).toMatchObject({ title: 'Blue glaze vase' });
  });

  it('shortens a description on a word boundary', () => {
    const text = `${'gốm '.repeat(60)}cuối`;
    const short = metaDescription(text);
    expect(short.length).toBeLessThanOrEqual(160);
    expect(short.endsWith('…')).toBe(true);
    expect(short).not.toMatch(/gố…$/);
  });

  it('escapes < in JSON-LD so the text cannot close the script tag', () => {
    const out = jsonLd({ '@type': 'Product', name: '</script><b>' });
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out)).toMatchObject({
      '@context': 'https://schema.org',
      name: '</script><b>',
    });
  });
});

describe('list page metadata (GH#341)', () => {
  it('uses the clean list path as canonical, so filters and ?page=N do not fork it', () => {
    const meta = pageMetadata({ locale: 'vi', href: '/san-pham', title: 'Sản phẩm' });
    expect(meta.alternates).toEqual({
      canonical: '/vi/san-pham',
      languages: { vi: '/vi/san-pham', en: '/en/products', 'x-default': '/vi/san-pham' },
    });
  });
});
