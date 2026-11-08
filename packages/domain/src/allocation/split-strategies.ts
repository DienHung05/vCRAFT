import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/**
 * Split strategies (SRS BR-06, FR-ORD-03): propose how a request quantity is shared across the
 * households' contribution offers. Pure and deterministic; the admin may still edit the proposal.
 *
 * - `CAPACITY` ("Theo năng lực"): shares proportional to household capacity, remainders by the largest
 *   remainder method (Hamilton).
 * - `CHEAPEST` ("Giá thấp trước"): greedy by ascending unit price until the quantity is covered.
 * - `BALANCED` ("Cân bằng"): equal shares, each capped at the household's ceiling.
 *
 * Every strategy respects the ceiling of a household (BR-L6): its offered maximum and, when declared,
 * its capacity for the request's category. The model has no minimum lot, so none is enforced here.
 */
export const SPLIT_STRATEGIES = ['CAPACITY', 'CHEAPEST', 'BALANCED'] as const;
export type SplitStrategy = (typeof SPLIT_STRATEGIES)[number];

export interface SplitOffer {
  readonly householdId: string;
  /** The most the household offered for this request. */
  readonly maxQuantity: number;
  readonly unitPriceVnd: number;
  /** The absolute date the household promised to finish. */
  readonly completionDate: Date;
  /** Declared capacity for the request's category (FR-ART-06); null/undefined when none is declared. */
  readonly capacity?: number | null | undefined;
}

export interface SplitRequest {
  readonly quantity: number;
  /** Quotation deadline: a completion date must fall after it. */
  readonly biddingClosesAt: Date;
  /** Delivery deadline: a completion date must not be later than it. */
  readonly requiredBy: Date;
}

export interface SplitAllocation {
  readonly householdId: string;
  readonly quantity: number;
  readonly unitPriceVnd: number;
  readonly completionDate: Date;
}

export interface SplitProposal {
  readonly strategy: SplitStrategy;
  /** One entry per input offer, in input order. A household that gets nothing has quantity 0. */
  readonly allocations: readonly SplitAllocation[];
  /** Σ proposed quantities. */
  readonly totalQuantity: number;
  /** Quantity the households cannot cover together (0 when the request is fully covered). */
  readonly shortfall: number;
  /** True when Σ = requested quantity. */
  readonly complete: boolean;
  /** Σ quantity × unit price, before any additional charge. */
  readonly productionTotalVnd: number;
  /** The latest completion date among the households that got a share; null when nobody did. */
  readonly estimatedCompletion: Date | null;
  /** Households skipped because their offer cannot be used (no ceiling, bad price, date outside the window). */
  readonly excluded: readonly string[];
}

export type SplitErrorCode = 'SPLIT_INPUT_INVALID';

interface Candidate {
  readonly offer: SplitOffer;
  readonly ceiling: number;
  readonly weight: number;
}

const isWhole = (value: number, minimum: number) => Number.isSafeInteger(value) && value >= minimum;

/** The most a household can take: its offered maximum, lowered to its declared capacity. */
export function splitCeiling(offer: Pick<SplitOffer, 'maxQuantity' | 'capacity'>): number {
  if (!isWhole(offer.maxQuantity, 0)) return 0;
  const capacity = offer.capacity;
  if (capacity === null || capacity === undefined) return offer.maxQuantity;
  return isWhole(capacity, 0) ? Math.min(offer.maxQuantity, capacity) : 0;
}

/** Ceiling first (more headroom), then cheaper, then earlier, then id: a stable order for every tie. */
function byPriority(a: Candidate, b: Candidate): number {
  return (
    b.ceiling - a.ceiling ||
    a.offer.unitPriceVnd - b.offer.unitPriceVnd ||
    a.offer.completionDate.getTime() - b.offer.completionDate.getTime() ||
    a.offer.householdId.localeCompare(b.offer.householdId)
  );
}

/**
 * Shares `total` across `candidates` in proportion to their weights, never above a ceiling. A share is
 * the floor of the exact proportion; leftover units go to the largest remainders (Hamilton), ties to the
 * heavier weight and then to the earlier candidate. A candidate whose share would pass its ceiling is
 * fixed at the ceiling and the rest is shared again among the others, until nobody exceeds it.
 * Callers guarantee Σ ceilings ≥ total.
 */
function shareProportionally(
  total: number,
  candidates: readonly Candidate[],
): Map<Candidate, number> {
  const result = new Map<Candidate, number>();
  let active = [...candidates];
  let remaining = total;
  while (active.length > 0 && remaining > 0) {
    const weightSum = active.reduce((sum, c) => sum + BigInt(c.weight), 0n);
    const exact = active.map((candidate, index) => {
      const numerator = BigInt(remaining) * BigInt(candidate.weight);
      return {
        candidate,
        index,
        floor: Number(numerator / weightSum),
        remainder: numerator % weightSum,
      };
    });
    let leftover = remaining - exact.reduce((sum, row) => sum + row.floor, 0);
    const byRemainder = [...exact].sort(
      (a, b) =>
        (a.remainder === b.remainder ? 0 : a.remainder > b.remainder ? -1 : 1) ||
        b.candidate.weight - a.candidate.weight ||
        a.index - b.index,
    );
    const share = new Map<Candidate, number>(exact.map((row) => [row.candidate, row.floor]));
    for (const row of byRemainder) {
      if (leftover <= 0) break;
      share.set(row.candidate, (share.get(row.candidate) ?? 0) + 1);
      leftover--;
    }
    const capped = active.filter((c) => (share.get(c) ?? 0) > c.ceiling);
    if (capped.length === 0) {
      for (const [candidate, quantity] of share) result.set(candidate, quantity);
      return result;
    }
    for (const candidate of capped) {
      result.set(candidate, candidate.ceiling);
      remaining -= candidate.ceiling;
    }
    active = active.filter((c) => !capped.includes(c));
  }
  for (const candidate of active) result.set(candidate, 0);
  return result;
}

/** Greedy fill in the given order, each household up to its ceiling, until `total` is covered. */
function fillInOrder(total: number, ordered: readonly Candidate[]): Map<Candidate, number> {
  const result = new Map<Candidate, number>();
  let remaining = total;
  for (const candidate of ordered) {
    const quantity = Math.min(remaining, candidate.ceiling);
    result.set(candidate, quantity);
    remaining -= quantity;
  }
  return result;
}

/**
 * Proposes a split of `request.quantity` across the offers with the chosen strategy.
 *
 * An offer is usable when its ceiling is positive, its unit price is a positive whole VND amount and
 * its completion date falls after the quotation deadline and no later than the delivery deadline;
 * otherwise the household is listed in `excluded` and gets 0. When the usable ceilings add up to less
 * than the request, every usable household is proposed at its ceiling and `shortfall` says what is left.
 * Fails only on invalid input: a non-positive-integer quantity, bad deadlines or a repeated household.
 */
export function proposeSplit(
  strategy: SplitStrategy,
  request: SplitRequest,
  offers: readonly SplitOffer[],
): Result<SplitProposal, DomainError<SplitErrorCode>> {
  const invalid = () => err(new DomainError('SPLIT_INPUT_INVALID', 'SPLIT_INPUT_INVALID'));
  if (
    !SPLIT_STRATEGIES.includes(strategy) ||
    !isWhole(request.quantity, 1) ||
    !(request.requiredBy.getTime() > request.biddingClosesAt.getTime()) ||
    new Set(offers.map((offer) => offer.householdId)).size !== offers.length
  ) {
    return invalid();
  }

  const closes = request.biddingClosesAt.getTime();
  const due = request.requiredBy.getTime();
  const usable = new Map<SplitOffer, Candidate>();
  const excluded: string[] = [];
  for (const offer of offers) {
    const completion = offer.completionDate.getTime();
    const ceiling = splitCeiling(offer);
    if (
      ceiling < 1 ||
      !isWhole(offer.unitPriceVnd, 1) ||
      !(completion > closes && completion <= due)
    ) {
      excluded.push(offer.householdId);
      continue;
    }
    // Capacity strategy weighs households by declared capacity, or by the offer when none is declared.
    const capacity = offer.capacity;
    const weight = capacity !== null && capacity !== undefined && capacity > 0 ? capacity : ceiling;
    usable.set(offer, { offer, ceiling, weight });
  }

  const candidates = [...usable.values()].sort(byPriority);
  const capacityTotal = candidates.reduce((sum, c) => sum + c.ceiling, 0);
  let quantities: Map<Candidate, number>;
  if (capacityTotal <= request.quantity) {
    // Not enough room (or exactly enough): everybody takes everything they can.
    quantities = new Map(candidates.map((c) => [c, c.ceiling]));
  } else if (strategy === 'CHEAPEST') {
    quantities = fillInOrder(
      request.quantity,
      [...candidates].sort(
        (a, b) =>
          a.offer.unitPriceVnd - b.offer.unitPriceVnd ||
          a.offer.completionDate.getTime() - b.offer.completionDate.getTime() ||
          byPriority(a, b),
      ),
    );
  } else if (strategy === 'BALANCED') {
    quantities = shareProportionally(
      request.quantity,
      candidates.map((c) => ({ ...c, weight: 1 })),
    );
  } else {
    quantities = shareProportionally(request.quantity, candidates);
  }

  // The balanced strategy re-created candidates with weight 1: read shares back by household.
  const byHousehold = new Map<string, number>();
  for (const [candidate, quantity] of quantities)
    byHousehold.set(candidate.offer.householdId, quantity);

  let totalQuantity = 0;
  let productionTotalVnd = 0;
  let latestTime = Number.NEGATIVE_INFINITY;
  const allocations = offers.map((offer): SplitAllocation => {
    const quantity = byHousehold.get(offer.householdId) ?? 0;
    totalQuantity += quantity;
    productionTotalVnd += quantity * offer.unitPriceVnd;
    if (quantity > 0) latestTime = Math.max(latestTime, offer.completionDate.getTime());
    return {
      householdId: offer.householdId,
      quantity,
      unitPriceVnd: offer.unitPriceVnd,
      completionDate: new Date(offer.completionDate),
    };
  });
  const shortfall = request.quantity - totalQuantity;
  return ok({
    strategy,
    allocations,
    totalQuantity,
    shortfall,
    complete: shortfall === 0,
    productionTotalVnd,
    estimatedCompletion: Number.isFinite(latestTime) ? new Date(latestTime) : null,
    excluded,
  });
}
