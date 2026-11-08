import type { OrderAllocation } from '@vcraft/database';
import { allocationLateness } from '@vcraft/domain';

/** The public schedule of one authorized share, without quotation prices or other households' offers. */
export function allocationTimeline(allocation: OrderAllocation, now = new Date()) {
  const part = allocation.quotation.parts.find((p) => p.householdId === allocation.household.id);
  const dueAt = part ? new Date(part.completionDate) : allocation.quotation.request.requiredBy;
  const lateness = allocationLateness(
    {
      quantity: allocation.quantity,
      completedQty: allocation.completedQty,
      startedAt: allocation.createdAt,
      dueAt,
    },
    now,
  );
  return {
    householdName: allocation.household.name,
    startedAt: allocation.createdAt.toISOString(),
    dueAt: dueAt.toISOString(),
    lateness: lateness.status,
    expectedQty: lateness.expectedQty,
    progressPercent:
      allocation.quantity === 0
        ? 0
        : Math.min(100, Math.round((allocation.completedQty / allocation.quantity) * 100)),
  };
}
