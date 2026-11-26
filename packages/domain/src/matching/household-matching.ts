import { remainingCapacity } from '../allocation/allocation-plan';

/** BR-05: how many households a request is sent to when the buyer did not choose any. */
export const RFQ_MATCH_LIMIT = 10;

/** What the platform knows about a household when it looks for the ones that fit a request. */
export interface MatchCandidate {
  readonly householdId: string;
  /** Units per month the household declared for the request's category (FR-ART-06); undefined when it declared none. */
  readonly declaredCapacity?: number | undefined;
  /** Quantity already tied up in the household's active allocations in the category (BR-L6); 0 when undefined. */
  readonly committed?: number | undefined;
  /** Published products the household has in the request's category. */
  readonly publishedProducts: number;
  /** Mean of the buyers' 1-5 star ratings (FR-ORD-11); null or undefined when the household has none yet. */
  readonly ratingAverage?: number | null | undefined;
}

/** How well a household's remaining capacity covers the requested quantity. UNKNOWN: no capacity declared or no quantity given. */
export type CapacityFit = 'FITS' | 'PARTIAL' | 'UNKNOWN';

/** A household that fits a request, with the facts the ranking used. */
export interface RankedMatch {
  readonly householdId: string;
  /** Declared capacity less committed quantity (never below zero); undefined when the household declared none. */
  readonly remainingCapacity: number | undefined;
  readonly publishedProducts: number;
  readonly ratingAverage: number | null;
  readonly capacityFit: CapacityFit;
}

/**
 * BR-05 / FR-RFQ-03: ranks the households that fit a request, best first.
 *
 * Callers pass only households that are already APPROVED with an unlocked representative. A household is
 * eligible when it works in the request's craft category: it declared capacity for it, or sells a published
 * product in it. A declared capacity of zero opts the household out of that category, and so does a
 * declared capacity that is fully committed to other active allocations. The best fit comes first:
 * remaining capacity (declared less committed), then the number of published products, then the buyers'
 * rating (a household with no rating yet ranks as the lowest), then the id so the order is stable.
 *
 * The model has no response-rate or on-time data and no "accepting orders" switch, so the score of BR-05
 * is capacity, catalogue depth and rating here.
 */
export function rankMatchingHouseholds(
  candidates: readonly MatchCandidate[],
  options: { quantity?: number; limit?: number } = {},
): RankedMatch[] {
  const { quantity, limit = RFQ_MATCH_LIMIT } = options;
  return candidates
    .filter((candidate) => worksInCategory(candidate.declaredCapacity, candidate.publishedProducts))
    .map((candidate): RankedMatch => {
      const remaining = remainingCapacity(candidate.declaredCapacity, candidate.committed ?? 0);
      let capacityFit: CapacityFit = 'UNKNOWN';
      if (remaining !== undefined && quantity !== undefined)
        capacityFit = remaining >= quantity ? 'FITS' : 'PARTIAL';
      return {
        householdId: candidate.householdId,
        remainingCapacity: remaining,
        publishedProducts: candidate.publishedProducts,
        ratingAverage: candidate.ratingAverage ?? null,
        capacityFit,
      };
    })
    .filter((match) => match.remainingCapacity === undefined || match.remainingCapacity > 0)
    .sort(
      (a, b) =>
        (b.remainingCapacity ?? 0) - (a.remainingCapacity ?? 0) ||
        b.publishedProducts - a.publishedProducts ||
        (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0) ||
        a.householdId.localeCompare(b.householdId),
    )
    .slice(0, Math.max(0, limit));
}

/** BR-05: the ids of the top `limit` households of {@link rankMatchingHouseholds}: who a request without chosen households is sent to. */
export function selectMatchingHouseholds(
  candidates: readonly MatchCandidate[],
  limit = RFQ_MATCH_LIMIT,
): string[] {
  return rankMatchingHouseholds(candidates, { limit }).map((match) => match.householdId);
}

/**
 * Whether a household works in a craft category: it declared capacity for it, or sells a published
 * product in it. A declared capacity of zero opts the household out of the category (BR-05, BR-05a).
 */
export function worksInCategory(
  declaredCapacity: number | undefined,
  publishedProducts: number,
): boolean {
  if (declaredCapacity !== undefined && declaredCapacity <= 0) return false;
  return (declaredCapacity ?? 0) > 0 || publishedProducts > 0;
}

/** What the platform knows about a household and a request when it decides whether the request is open to it. */
export interface OpenRequestEligibilityInput {
  readonly householdStatus: string;
  /** True when the household representative's account is locked. */
  readonly representativeLocked: boolean;
  /** The request's craft category; null or undefined when the buyer chose none. */
  readonly requestCategory: string | null | undefined;
  /** Units per month the household declared for the request's category; undefined when it declared none. */
  readonly declaredCapacity?: number | undefined;
  /** Published products the household has in the request's category. */
  readonly publishedProducts: number;
}

/**
 * BR-05a: an open coordinated request is visible to, and can be offered on by, an APPROVED household with an
 * unlocked representative that works in the request's category (declared capacity above zero, or a published
 * product in it). A request without a category is open to nobody.
 */
export function isEligibleForOpenRequest(input: OpenRequestEligibilityInput): boolean {
  if (!input.requestCategory) return false;
  if (input.householdStatus !== 'APPROVED' || input.representativeLocked) return false;
  return worksInCategory(input.declaredCapacity, input.publishedProducts);
}

/** The request fields BR-05a looks at. */
export interface OpenRequestState {
  readonly status: string;
  readonly coordinationOptIn: boolean;
  /** The administrator who claimed the request; null or undefined while nobody has. */
  readonly coordinatorId?: string | null | undefined;
  readonly biddingClosesAt: Date;
}

/** BR-05a: a request is open while it is coordinated, claimed by an administrator and still takes offers. */
export function isOpenCoordinatedRequest(
  request: OpenRequestState,
  now: Date = new Date(),
): boolean {
  return (
    request.coordinationOptIn &&
    Boolean(request.coordinatorId) &&
    (request.status === 'SENT' || request.status === 'BIDDING') &&
    request.biddingClosesAt.getTime() > now.getTime()
  );
}
