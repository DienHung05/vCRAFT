import type { HouseholdSummaryDto, SuggestedHouseholdDto } from '@vcraft/contracts';

/** Best-rated households first; households with the same rating keep the order the API returned. */
export function byRating(households: readonly HouseholdSummaryDto[]): HouseholdSummaryDto[] {
  return [...households].sort((a, b) => (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0));
}

/** The households not already shown among the suggestions, best-rated first. */
export function otherHouseholds(
  households: readonly HouseholdSummaryDto[],
  suggested: readonly SuggestedHouseholdDto[],
): HouseholdSummaryDto[] {
  const taken = new Set(suggested.map((household) => household.id));
  return byRating(households.filter((household) => !taken.has(household.id)));
}
