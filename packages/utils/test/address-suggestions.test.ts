import { describe, expect, it } from 'vitest';
import { type AdministrativeUnit, suggestAddresses } from '../src/vn/address-suggestions';

const UNITS: AdministrativeUnit[] = [
  [1, 'Thành phố Hà Nội', ['Phường Ba Đình', 'Xã Bát Tràng', 'Xã Gia Lâm']],
  [79, 'Thành phố Hồ Chí Minh', ['Phường Bến Thành', 'Phường Sài Gòn']],
];

describe('suggestAddresses', () => {
  it('matches the ward without diacritics and keeps the typed street', () => {
    expect(suggestAddresses('12 Giang Cao, bat tr', UNITS)).toEqual([
      '12 Giang Cao, Xã Bát Tràng, Thành phố Hà Nội',
    ]);
  });

  it('matches words of the province too', () => {
    expect(suggestAddresses('sai gon ho chi', UNITS)).toEqual([
      'Phường Sài Gòn, Thành phố Hồ Chí Minh',
    ]);
  });

  it('suggests nothing for fewer than two letters or no match', () => {
    expect(suggestAddresses('12 Giang Cao, b', UNITS)).toEqual([]);
    expect(suggestAddresses('', UNITS)).toEqual([]);
    expect(suggestAddresses('Đà Lạt', UNITS)).toEqual([]);
  });

  it('caps the number of suggestions', () => {
    expect(suggestAddresses('ha noi', UNITS, 2)).toHaveLength(2);
  });
});
