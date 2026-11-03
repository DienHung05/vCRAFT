import { describe, expect, it } from 'vitest';
import { suggestPriceRange } from '../src/rfq';

describe('suggestPriceRange', () => {
  it('returns null with nothing to go on', () => {
    expect(suggestPriceRange([], [])).toBeNull();
    expect(suggestPriceRange([0, -5], [Number.NaN])).toBeNull();
  });

  it('uses only the household’s own offers once it has three', () => {
    expect(suggestPriceRange([40_000, 50_000, 60_000], [1_000_000, 2_000_000])).toEqual({
      minVnd: 45_000,
      maxVnd: 55_000,
      basis: 'OWN',
      ownSamples: 3,
      catalogSamples: 0,
    });
  });

  it('fills in from the catalogue when the household has fewer offers', () => {
    expect(suggestPriceRange([50_000], [30_000, 70_000, 90_000])).toEqual({
      minVnd: 45_000,
      maxVnd: 75_000,
      basis: 'MIXED',
      ownSamples: 1,
      catalogSamples: 3,
    });
  });

  it('falls back to the catalogue alone', () => {
    expect(suggestPriceRange([], [120_000])).toEqual({
      minVnd: 120_000,
      maxVnd: 120_000,
      basis: 'CATALOG',
      ownSamples: 0,
      catalogSamples: 1,
    });
  });

  it('rounds to 1,000 VND and never below it', () => {
    const hint = suggestPriceRange([12_345, 12_655, 300], []);
    expect(hint?.minVnd).toBe(6_000);
    expect(hint?.maxVnd).toBe(13_000);
    expect(suggestPriceRange([200], [])?.minVnd).toBe(1_000);
  });

  it('ignores the order of the inputs', () => {
    expect(suggestPriceRange([60_000, 40_000, 50_000], [])).toEqual(
      suggestPriceRange([40_000, 50_000, 60_000], []),
    );
  });
});
