import { describe, expect, it } from 'vitest';
import {
  CRAFT_CATEGORIES,
  certificationYear,
  effectiveCraftCategory,
  inferCraftCategory,
} from '../src/household';

describe('craft category (FR-ART-01)', () => {
  it('has a fixed list that ends with the catch-all', () => {
    expect(CRAFT_CATEGORIES).toEqual(['GOM_SU', 'MEN', 'VE_GOM', 'NUNG', 'KHAC']);
  });

  it('maps legacy free text from the demo data sensibly', () => {
    expect(inferCraftCategory('men lam')).toBe('MEN');
    expect(inferCraftCategory('men ngọc và men rạn')).toBe('MEN');
    expect(inferCraftCategory('vẽ tay hoa sen, chim lạc')).toBe('VE_GOM');
    expect(inferCraftCategory('Nung lò củi')).toBe('NUNG');
    expect(inferCraftCategory('bình hoa, lục bình')).toBe('GOM_SU');
  });

  it('puts text with no obvious match under KHAC and gives empty text no category', () => {
    expect(inferCraftCategory('đồ thờ, lư hương')).toBe('KHAC');
    expect(inferCraftCategory('   ')).toBeNull();
    expect(inferCraftCategory(null)).toBeNull();
  });

  it('prefers the stored category over the inferred one', () => {
    expect(effectiveCraftCategory('NUNG', 'men lam')).toBe('NUNG');
    expect(effectiveCraftCategory(null, 'men lam')).toBe('MEN');
    expect(effectiveCraftCategory(undefined, undefined)).toBeNull();
  });
});

describe('certificationYear (FR-ART-03)', () => {
  it('derives the year from the issue date when there is one', () => {
    expect(certificationYear({ issuedOn: '2021-06-30', year: 1999 })).toBe(2021);
  });

  it('keeps the legacy year when there is no date', () => {
    expect(certificationYear({ year: 2019 })).toBe(2019);
    expect(certificationYear({ issuedOn: null, year: 2019 })).toBe(2019);
    expect(certificationYear({})).toBeNull();
  });
});
