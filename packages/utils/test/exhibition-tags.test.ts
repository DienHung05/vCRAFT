import { describe, expect, it } from 'vitest';
import {
  EXHIBITION_TAG,
  householdTag,
  isExhibitionTag,
  MAX_REVALIDATE_TAGS,
  normalizeExhibitionTags,
  productTag,
  traceTag,
} from '../src/exhibition-tags';

describe('exhibition tags', () => {
  it('builds the entity tags and refuses non-slug input', () => {
    expect(householdTag('lo-duc-phat')).toBe('household:lo-duc-phat');
    expect(productTag('binh-gom-df6p3wze')).toBe('product:binh-gom-df6p3wze');
    expect(traceTag('df6p3wze')).toBe('trace:DF6P3WZE');
    expect(householdTag('Lò Đức Phát')).toBeNull();
    expect(productTag('a b')).toBeNull();
    expect(traceTag('DF-6P')).toBeNull();
  });

  it('accepts only the documented shapes', () => {
    for (const ok of ['exhibition', 'household:a-1', 'product:b', 'trace:AB12'])
      expect(isExhibitionTag(ok)).toBe(true);
    for (const bad of [
      '',
      'news',
      'household:',
      'household:A',
      'trace:ab',
      'exhibition:x',
      1,
      null,
    ])
      expect(isExhibitionTag(bad)).toBe(false);
  });

  it('de-duplicates, skips nulls and widens to the broad tag when something is invalid', () => {
    expect(normalizeExhibitionTags(['product:a', 'product:a', null, 'trace:X1'])).toEqual([
      'product:a',
      'trace:X1',
    ]);
    expect(normalizeExhibitionTags(['product:a', 'bad tag'])).toEqual([EXHIBITION_TAG]);
  });

  it('widens to the broad tag when over the cap', () => {
    const many = Array.from({ length: MAX_REVALIDATE_TAGS + 1 }, (_, i) => `product:p-${i}`);
    expect(normalizeExhibitionTags(many)).toEqual([EXHIBITION_TAG]);
  });
});
