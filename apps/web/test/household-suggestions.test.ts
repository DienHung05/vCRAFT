import type { HouseholdSummaryDto, SuggestedHouseholdDto } from '@vcraft/contracts';
import { describe, expect, it } from 'vitest';
import { byRating, otherHouseholds } from '@/features/rfq/household-suggestions';

const household = (id: string, ratingAverage: number | null) =>
  ({ id, name: id, ratingAverage, ratingCount: 0 }) as HouseholdSummaryDto;

describe('household suggestions', () => {
  it('orders households by rating, keeping API order on ties', () => {
    expect(
      byRating([household('a', null), household('b', 4), household('c', 5)]).map((h) => h.id),
    ).toEqual(['c', 'b', 'a']);
  });

  it('leaves out the suggested households from the other list', () => {
    const suggested = [{ id: 'b' }] as SuggestedHouseholdDto[];
    expect(
      otherHouseholds([household('a', 3), household('b', 5), household('c', 4)], suggested).map(
        (h) => h.id,
      ),
    ).toEqual(['c', 'a']);
    expect(otherHouseholds([household('a', 3)], []).map((h) => h.id)).toEqual(['a']);
  });
});
