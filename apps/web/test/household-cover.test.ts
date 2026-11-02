import { describe, expect, it } from 'vitest';
import { householdCover } from '@/features/catalog/view-models';

const credit = {
  title: 'File:A.jpg',
  author: 'Tác giả',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
};
const base = { banner: null, coverUrl: null, coverVariants: [], gallery: [] };

describe('householdCover', () => {
  it('uses the banner with its own description, English on /en', () => {
    const banner = {
      url: 'https://cdn.test/b.webp',
      alt: 'Gian hàng',
      altEn: 'A shop',
      variants: [],
      credit,
    };
    expect(householdCover('vi', { ...base, banner }).alt).toBe('Gian hàng');
    const en = householdCover('en', { ...base, banner });
    expect(en.alt).toBe('A shop');
    expect(en.credit).toEqual(credit);
    expect(en.view?.src).toBe('https://cdn.test/b.webp');
  });

  it("falls back to the first workshop photo with that photo's description", () => {
    const gallery = [{ url: 'https://cdn.test/g.webp', alt: 'Bàn xoay', altEn: 'Wheels', credit }];
    const cover = householdCover('en', { ...base, coverUrl: 'https://cdn.test/g.webp', gallery });
    expect(cover.alt).toBe('Wheels');
    expect(cover.credit).toEqual(credit);
  });

  it('has no photo and no description when the household has none (the page draws an illustration)', () => {
    expect(householdCover('vi', base)).toEqual({ view: undefined, alt: null, credit: null });
  });
});
