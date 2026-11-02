import { describe, expect, it } from 'vitest';
import { presetKindOf } from '@/features/catalog/preset-figure';
import { altFor } from '@/features/catalog/view-models';

/** Every product name of the demo data (42 names) and the illustration it must get. */
const DEMO_NAMES: readonly [string, string, string][] = [
  ['Bát chiết yêu men hoa nâu', 'TABLEWARE', 'bowl'],
  ['Bát chiết yêu men nâu', 'TABLEWARE', 'bowl'],
  ['Bát vẽ sen men trong', 'TABLEWARE', 'bowl'],
  ['Bát ăn cơm men rạn', 'TABLEWARE', 'bowl'],
  ['Bát ăn cơm vẽ sen', 'TABLEWARE', 'bowl'],
  ['Bình hút lộc men lam', 'VASE', 'vase'],
  ['Bình hút lộc men trắng ngà', 'VASE', 'vase'],
  ['Bình ngâm rượu men rạn', 'VASE', 'jar'],
  ['Bình ngâm rượu vẽ sen', 'VASE', 'jar'],
  ['Bình đựng nước men ngọc', 'VASE', 'vase'],
  ['Bình đựng nước vẽ lam', 'VASE', 'vase'],
  ['Bộ ấm chén men rạn', 'TEA', 'teaset'],
  ['Bộ ấm chén vẽ sen', 'TEA', 'teaset'],
  ['Chén tống men lam', 'TEA', 'cup'],
  ['Chén tống men trắng ngà', 'TEA', 'cup'],
  ['Chậu cây mini men hoa nâu', 'DECOR', 'jar'],
  ['Chậu cây mini men nâu', 'DECOR', 'jar'],
  ['Cốc men trắng quai tròn', 'TEA', 'cup'],
  ['Cốc quai men ngọc', 'TEA', 'cup'],
  ['Cốc quai vẽ lam', 'TEA', 'cup'],
  ['Hũ đựng trà men hoa nâu', 'TEA', 'jar'],
  ['Hũ đựng trà men nâu', 'TEA', 'jar'],
  ['Khay trà men rạn', 'TEA', 'teaset'],
  ['Khay trà vẽ sen', 'TEA', 'teaset'],
  ['Lư hương men hoa nâu', 'WORSHIP', 'incense'],
  ['Lư hương men nâu', 'WORSHIP', 'incense'],
  ['Lọ hoa miệng loe men hoa nâu', 'VASE', 'vase'],
  ['Lọ hoa miệng loe men nâu', 'VASE', 'vase'],
  ['Lục bình men lam', 'VASE', 'vase'],
  ['Lục bình men trắng ngà', 'VASE', 'vase'],
  ['Tách trà men rạn', 'TEA', 'cup'],
  ['Tách trà vẽ sen', 'TEA', 'cup'],
  ['Tô sứ men ngọc', 'TABLEWARE', 'bowl'],
  ['Tô sứ vẽ lam', 'TABLEWARE', 'bowl'],
  ['Âu đựng canh men ngọc', 'TABLEWARE', 'bowl'],
  ['Âu đựng canh vẽ lam', 'TABLEWARE', 'bowl'],
  ['Đĩa trà men lam', 'TEA', 'plate'],
  ['Đĩa trà men trắng ngà', 'TEA', 'plate'],
  ['Đĩa tròn men lam', 'TABLEWARE', 'plate'],
  ['Đĩa tròn men trắng ngà', 'TABLEWARE', 'plate'],
  ['Ống đựng bút men ngọc', 'DECOR', 'jar'],
  ['Ống đựng bút vẽ lam', 'DECOR', 'jar'],
];

describe('presetKindOf', () => {
  it.each(DEMO_NAMES)('%s (%s) gets the %s illustration', (name, category, kind) => {
    expect(presetKindOf(category, name)).toBe(kind);
  });

  it('is not fooled by accents or capitals', () => {
    expect(presetKindOf(undefined, 'LU HUONG đồng')).toBe('incense');
    expect(presetKindOf(undefined, 'bat com')).toBe('bowl');
  });

  it('falls back to the category, then to a generic piece of pottery', () => {
    expect(presetKindOf('TABLEWARE', 'Món mới')).toBe('bowl');
    expect(presetKindOf('WORSHIP', 'Món mới')).toBe('incense');
    expect(presetKindOf('OTHER', 'Món mới')).toBe('generic');
    expect(presetKindOf(undefined, 'Món mới')).toBe('generic');
  });
});

describe('altFor', () => {
  it('uses the English description on /en and the Vietnamese one otherwise', () => {
    expect(altFor('en', 'Bát', 'A bowl')).toBe('A bowl');
    expect(altFor('vi', 'Bát', 'A bowl')).toBe('Bát');
  });

  it('falls back to the Vietnamese description when there is no English one', () => {
    expect(altFor('en', 'Bát', null)).toBe('Bát');
    expect(altFor('en', 'Bát', '  ')).toBe('Bát');
    expect(altFor('en', 'Bát')).toBe('Bát');
  });
});
