import { describe, expect, it } from 'vitest';
import { vndInWords } from '../src/vn/amount-in-words';

describe('vndInWords', () => {
  it.each([
    [0, 'Không đồng'],
    [5, 'Năm đồng'],
    [10, 'Mười đồng'],
    [15, 'Mười lăm đồng'],
    [21, 'Hai mươi mốt đồng'],
    [25, 'Hai mươi lăm đồng'],
    [44, 'Bốn mươi bốn đồng'],
    [105, 'Một trăm linh năm đồng'],
    [110, 'Một trăm mười đồng'],
    [1_000, 'Một nghìn đồng'],
    [1_005, 'Một nghìn không trăm linh năm đồng'],
    [12_500, 'Mười hai nghìn năm trăm đồng'],
    [250_000, 'Hai trăm năm mươi nghìn đồng'],
    [1_250_000, 'Một triệu hai trăm năm mươi nghìn đồng'],
    [1_000_015, 'Một triệu không trăm mười lăm đồng'],
    [20_000_000, 'Hai mươi triệu đồng'],
    [1_000_000_000, 'Một tỷ đồng'],
    [2_005_000_000, 'Hai tỷ không trăm linh năm triệu đồng'],
    [1_000_000_000_000, 'Một nghìn tỷ đồng'],
  ])('%i → %s', (amount, words) => {
    expect(vndInWords(amount)).toBe(words);
  });

  it('reads the largest safe integer, repeating the tỷ cycle', () => {
    expect(vndInWords(Number.MAX_SAFE_INTEGER)).toBe(
      'Chín triệu không trăm linh bảy nghìn một trăm chín mươi chín tỷ hai trăm năm mươi bốn triệu bảy trăm bốn mươi nghìn chín trăm chín mươi mốt đồng',
    );
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s', (amount) => {
    expect(vndInWords(amount)).toBeNull();
  });
});
