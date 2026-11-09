/** BR-05: how many households a request is sent to when the buyer did not choose any. */
export const RFQ_MATCH_LIMIT = 10;

/** What the platform knows about a household when it looks for the ones that fit a request. */
export interface MatchCandidate {
  readonly householdId: string;
  /** Units per month the household declared for the request's category (FR-ART-06); undefined when it declared none. */
  readonly declaredCapacity?: number | undefined;
  /** Published products the household has in the request's category. */
  readonly publishedProducts: number;
  /** Mean of the buyers' 1-5 star ratings (FR-ORD-11); null or undefined when the household has none yet. */
  readonly ratingAverage?: number | null | undefined;
}

/**
 * BR-05 / FR-RFQ-03: picks the households a request without chosen households is sent to.
 *
 * Callers pass only households that are already APPROVED with an unlocked representative. A household is
 * eligible when it works in the request's craft category: it declared capacity for it, or sells a published
 * product in it. A declared capacity of zero opts the household out of that category. The best fit comes
 * first: declared capacity, then the number of published products, then the buyers' rating (a household
 * with no rating yet ranks as the lowest), then the id so the order is stable.
 *
 * The model has no response-rate or on-time data and no "accepting orders" switch, so the score of BR-05
 * is capacity, catalogue depth and rating here.
 */
export function selectMatchingHouseholds(
  candidates: readonly MatchCandidate[],
  limit = RFQ_MATCH_LIMIT,
): string[] {
  return candidates
    .filter((candidate) => {
      const capacity = candidate.declaredCapacity;
      if (capacity !== undefined && capacity <= 0) return false;
      return (capacity ?? 0) > 0 || candidate.publishedProducts > 0;
    })
    .sort(
      (a, b) =>
        (b.declaredCapacity ?? 0) - (a.declaredCapacity ?? 0) ||
        b.publishedProducts - a.publishedProducts ||
        (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) ||
        a.householdId.localeCompare(b.householdId),
    )
    .slice(0, Math.max(0, limit))
    .map((candidate) => candidate.householdId);
}
