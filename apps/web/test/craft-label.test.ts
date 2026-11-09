import { describe, expect, it } from 'vitest';
import { craftLabel } from '@/features/catalog/craft-label';
import { materialUnitKey, materialUnitLabel } from '@/features/news/material-units';

const label = (category: string) => `[${category}]`;

describe('craftLabel', () => {
  it('keeps the free text on vi', () => {
    expect(craftLabel('vi', { craft: 'Men lam', craftCategory: 'MEN' }, label)).toBe('Men lam');
    expect(craftLabel('vi', { craft: null, craftCategory: 'MEN' }, label)).toBeNull();
  });

  it('shows the translated category on en', () => {
    expect(craftLabel('en', { craft: 'Men lam', craftCategory: 'MEN' }, label)).toBe('[MEN]');
  });

  it('falls back to the free text on en when there is no category', () => {
    expect(craftLabel('en', { craft: 'Men lam', craftCategory: null }, label)).toBe('Men lam');
    expect(craftLabel('en', { craft: null }, label)).toBeNull();
  });
});

describe('materialUnitLabel', () => {
  const translate = (key: string) => `t:${key}`;

  it('maps the known Vietnamese units', () => {
    expect(materialUnitKey('tấn')).toBe('tonne');
    expect(materialUnitLabel('kg', translate)).toBe('t:kg');
    expect(materialUnitLabel(' Bình 12 kg ', translate)).toBe('t:cylinder12kg');
  });

  it('shows an unknown unit unchanged', () => {
    expect(materialUnitLabel('thùng', translate)).toBe('thùng');
    expect(materialUnitKey('constructor')).toBeNull();
  });
});
