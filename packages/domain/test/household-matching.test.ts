import { describe, expect, it } from 'vitest';
import { RFQ_MATCH_LIMIT, rankMatchingHouseholds, selectMatchingHouseholds } from '../src';

describe('selectMatchingHouseholds', () => {
  it('keeps households that declared capacity or sell in the category, best fit first', () => {
    expect(
      selectMatchingHouseholds([
        { householdId: 'c', publishedProducts: 1 },
        { householdId: 'a', declaredCapacity: 500, publishedProducts: 0 },
        { householdId: 'b', declaredCapacity: 500, publishedProducts: 3 },
        { householdId: 'none', publishedProducts: 0 },
      ]),
    ).toEqual(['b', 'a', 'c']);
  });

  it('breaks capacity and catalogue ties by rating, then by id', () => {
    expect(
      selectMatchingHouseholds([
        { householdId: 'a', publishedProducts: 2 },
        { householdId: 'b', publishedProducts: 2, ratingAverage: 3.5 },
        { householdId: 'c', publishedProducts: 2, ratingAverage: 4.8 },
        { householdId: 'd', publishedProducts: 3, ratingAverage: 1 },
      ]),
    ).toEqual(['d', 'c', 'b', 'a']);
  });

  it('drops a household that declared zero capacity for the category', () => {
    expect(
      selectMatchingHouseholds([{ householdId: 'a', declaredCapacity: 0, publishedProducts: 5 }]),
    ).toEqual([]);
  });

  it('caps the invitations and orders ties by id', () => {
    const many = Array.from({ length: 15 }, (_, index) => ({
      householdId: `h${String(index).padStart(2, '0')}`,
      publishedProducts: 1,
    }));
    const picked = selectMatchingHouseholds([...many].reverse());
    expect(picked).toHaveLength(RFQ_MATCH_LIMIT);
    expect(picked[0]).toBe('h00');
    expect(selectMatchingHouseholds(many, 3)).toEqual(['h00', 'h01', 'h02']);
  });
});

describe('rankMatchingHouseholds', () => {
  it('ranks by remaining capacity, so committed quantity lowers a household', () => {
    const ranked = rankMatchingHouseholds([
      { householdId: 'a', declaredCapacity: 500, committed: 400, publishedProducts: 5 },
      { householdId: 'b', declaredCapacity: 300, publishedProducts: 1 },
    ]);
    expect(ranked.map((m) => m.householdId)).toEqual(['b', 'a']);
    expect(ranked[1]?.remainingCapacity).toBe(100);
  });

  it('drops a household whose declared capacity is fully committed', () => {
    expect(
      rankMatchingHouseholds([
        { householdId: 'a', declaredCapacity: 100, committed: 100, publishedProducts: 5 },
        { householdId: 'b', declaredCapacity: 100, committed: 150, publishedProducts: 5 },
      ]),
    ).toEqual([]);
  });

  it('reports how the remaining capacity covers the quantity', () => {
    const fitsFor = (quantity?: number) =>
      rankMatchingHouseholds(
        [
          { householdId: 'a', declaredCapacity: 100, committed: 20, publishedProducts: 1 },
          { householdId: 'b', publishedProducts: 1 },
        ],
        quantity === undefined ? {} : { quantity },
      ).map((m) => [m.householdId, m.capacityFit]);
    expect(fitsFor(80)).toEqual([
      ['a', 'FITS'],
      ['b', 'UNKNOWN'],
    ]);
    expect(fitsFor(81)).toEqual([
      ['a', 'PARTIAL'],
      ['b', 'UNKNOWN'],
    ]);
    expect(fitsFor()).toEqual([
      ['a', 'UNKNOWN'],
      ['b', 'UNKNOWN'],
    ]);
  });

  it('applies the limit and defaults to RFQ_MATCH_LIMIT', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      householdId: `h${String(i).padStart(2, '0')}`,
      publishedProducts: 1,
    }));
    expect(rankMatchingHouseholds(many)).toHaveLength(RFQ_MATCH_LIMIT);
    expect(rankMatchingHouseholds(many, { limit: 2 })).toHaveLength(2);
  });
});
