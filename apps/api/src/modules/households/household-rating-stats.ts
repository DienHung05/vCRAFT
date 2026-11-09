import type { EntityManager } from '@mikro-orm/core';
import { HouseholdRating } from '@vcraft/database';
import { type RatingSummary, summarizeRatings } from '@vcraft/domain';

/** What a household has no ratings yet. */
export const NO_RATINGS: RatingSummary = { average: null, count: 0 };

/**
 * The buyers' rating summary of each given household (FR-ORD-11): the mean with one decimal and the number
 * of ratings. Households without a rating are absent from the map. Only counts and the mean leave this
 * function; the comments stay private to the buyer who wrote them.
 */
export async function ratingSummaries(
  em: EntityManager,
  householdIds: readonly string[],
): Promise<Map<string, RatingSummary>> {
  const summaries = new Map<string, RatingSummary>();
  if (householdIds.length === 0) return summaries;
  const rows = await em.find(
    HouseholdRating,
    { household: { $in: [...new Set(householdIds)] } },
    { fields: ['household', 'stars'] },
  );
  const starsOf = new Map<string, number[]>();
  for (const row of rows) {
    const list = starsOf.get(row.household.id) ?? [];
    list.push(row.stars);
    starsOf.set(row.household.id, list);
  }
  for (const [householdId, stars] of starsOf) summaries.set(householdId, summarizeRatings(stars));
  return summaries;
}
