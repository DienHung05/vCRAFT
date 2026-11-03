import { DomainError } from '../shared/domain-error';
import { err, ok, type Result } from '../shared/result';

/**
 * Allocation schedule (FR-ORD, PLAN E10): where an allocation should be by now, whether it is falling
 * behind, and how to hand the rest of a late allocation to other households.
 */

/** Below the expected curve by more than this share of the allocation counts as behind. */
export const BEHIND_TOLERANCE = 0.1;

export type LatenessStatus = 'DONE' | 'ON_TRACK' | 'BEHIND' | 'OVERDUE';

export interface ScheduledAllocation {
  quantity: number;
  completedQty: number;
  /** When production of this part started. */
  startedAt: Date;
  /** The completion date the household committed to. */
  dueAt: Date;
}

export interface Lateness {
  status: LatenessStatus;
  /** Pieces that should be done by now on a straight line from start to due date. */
  expectedQty: number;
  /** Expected minus done, never negative. */
  shortfall: number;
}

/** Share of the work expected by `now`: 0 before the start, 1 from the due date, linear between. */
export function expectedShare(startedAt: Date, dueAt: Date, now: Date): number {
  const span = dueAt.getTime() - startedAt.getTime();
  if (span <= 0) return now >= dueAt ? 1 : 0;
  return Math.min(1, Math.max(0, (now.getTime() - startedAt.getTime()) / span));
}

/**
 * The lateness of one allocation at `now`: done when everything is made; overdue past the due date with
 * pieces left; behind when it trails the straight-line curve by more than 10% of its quantity.
 */
export function allocationLateness(allocation: ScheduledAllocation, now: Date): Lateness {
  const { quantity, completedQty } = allocation;
  const expectedQty = Math.round(
    expectedShare(allocation.startedAt, allocation.dueAt, now) * quantity,
  );
  const shortfall = Math.max(0, expectedQty - completedQty);
  if (completedQty >= quantity) return { status: 'DONE', expectedQty, shortfall: 0 };
  if (now > allocation.dueAt) return { status: 'OVERDUE', expectedQty, shortfall };
  return {
    status: shortfall > BEHIND_TOLERANCE * quantity ? 'BEHIND' : 'ON_TRACK',
    expectedQty,
    shortfall,
  };
}

export interface AllocationShare {
  householdId: string;
  quantity: number;
  completedQty: number;
}

export interface ReallocationTarget {
  householdId: string;
  quantity: number;
}

export type ReallocationError = 'INVALID_TARGETS' | 'NOTHING_LEFT' | 'SUM_MISMATCH';

/**
 * Hands the unfinished part of the allocation at `index` to other households (FR-ORD-09): the late one
 * keeps exactly what it has made, each target gets its share added (a household already in the order
 * keeps one row), and the order's total never changes. Targets must be whole positive numbers, must not
 * name the late household, and must add up to the remaining quantity.
 */
export function reallocate(
  allocations: readonly AllocationShare[],
  index: number,
  targets: readonly ReallocationTarget[],
): Result<AllocationShare[], DomainError<ReallocationError>> {
  const late = allocations[index];
  if (!late) return err(new DomainError('INVALID_TARGETS', 'Unknown allocation'));
  const remaining = late.quantity - late.completedQty;
  if (remaining <= 0) return err(new DomainError('NOTHING_LEFT', 'Nothing left to reallocate'));
  const ids = new Set<string>();
  for (const target of targets) {
    if (
      !Number.isInteger(target.quantity) ||
      target.quantity <= 0 ||
      target.householdId === late.householdId ||
      ids.has(target.householdId)
    )
      return err(
        new DomainError(
          'INVALID_TARGETS',
          'Each target is another household with a whole positive quantity',
        ),
      );
    ids.add(target.householdId);
  }
  const moved = targets.reduce((sum, target) => sum + target.quantity, 0);
  if (targets.length === 0 || moved !== remaining)
    return err(
      new DomainError('SUM_MISMATCH', 'Targets must add up to the remaining quantity', {
        remaining,
        moved,
      }),
    );

  const next = allocations.map((a, i) =>
    i === index ? { ...a, quantity: a.completedQty } : { ...a },
  );
  for (const target of targets) {
    const existing = next.find((a, i) => i !== index && a.householdId === target.householdId);
    if (existing) existing.quantity += target.quantity;
    else next.push({ householdId: target.householdId, quantity: target.quantity, completedQty: 0 });
  }
  return ok(next);
}
