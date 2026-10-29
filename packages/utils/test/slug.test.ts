import { describe, expect, it } from 'vitest';
import { slugify } from '../src';

describe('slugify', () => {
  it.each([
    ['Gốm Đông Hải', 'gom-dong-hai'],
    ['  Bình men rạn – 01 ', 'binh-men-ran-01'],
    ['Lò  gốm  Đức---Phú', 'lo-gom-duc-phu'],
    ['!!!', ''],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('cắt theo độ dài mà không để lại gạch cuối', () => {
    expect(slugify('ab cd ef', 3)).toBe('ab');
  });
});
