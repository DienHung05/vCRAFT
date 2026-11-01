import { describe, expect, it } from 'vitest';
import { ProductCardSchema } from '../src/catalog';
import { PublicImageSchema } from '../src/media';

const legacyImage = {
  mediaId: '00000000-0000-4000-8000-000000000001',
  url: 'https://cdn.test/v/1280.webp',
  alt: 'Xưởng gốm',
  caption: null,
  credit: null,
};

describe('public image variants', () => {
  it('keeps the variants the API sends', () => {
    const variants = [
      { format: 'avif', width: 640, height: 360, url: 'https://cdn.test/v/640.avif' },
      { format: 'webp', width: 640, height: 360, url: 'https://cdn.test/v/640.webp' },
    ];
    const image = PublicImageSchema.parse({ ...legacyImage, width: 1280, height: 720, variants });
    expect(image).toMatchObject({ url: legacyImage.url, width: 1280, height: 720, variants });
  });

  it('parses an older API payload without variants (web deployed before the API)', () => {
    expect(PublicImageSchema.parse(legacyImage)).toMatchObject({
      url: legacyImage.url,
      width: null,
      height: null,
      variants: [],
    });
    const card = ProductCardSchema.parse({
      id: 'a',
      name: 'Bình',
      slug: 'binh',
      traceCode: 'ABCD2345',
      kind: 'OBJECT',
      category: 'VASE',
      priceVnd: 1,
      stock: 1,
      coverUrl: null,
      coverAlt: null,
      publishedAt: null,
      household: { name: 'Hộ', slug: 'ho' },
    });
    expect(card.coverVariants).toEqual([]);
  });
});
