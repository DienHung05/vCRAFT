import type { EntityManager } from '@mikro-orm/core';
import { OrderAllocation } from '@vcraft/database';
import { isWithinCapacity, type ProductCategory, remainingCapacity } from '@vcraft/domain';
import { AppError } from '../../../common/errors/app-error';

/** What the API needs of a household to know its declared capacity (FR-ART-06). */
interface CapacityHolder {
  capacityByCategory?: Partial<Record<string, number>> | null;
}

/**
 * The capacity a household declared (units per month) for the request's category. Undefined when the
 * request has no category or the household declared none: nothing to enforce then.
 */
export function declaredCapacity(
  household: CapacityHolder,
  category: string | null | undefined,
): number | undefined {
  if (!category) return undefined;
  return household.capacityByCategory?.[category];
}

/**
 * Allocations that still tie up a household's capacity: shares of orders that are accepted or in
 * production and not yet finished, declined or cancelled.
 */
const COMMITTED_STATUSES = ['PROPOSED', 'CONFIRMED', 'IN_PROGRESS'] as const;
const COMMITTED_REQUEST_STATUSES = ['ACCEPTED', 'IN_PRODUCTION'] as const;

/**
 * Σ quantity of each household's other active allocations in the request's category (BR-L6). The request
 * being edited is left out, so saving the same split again does not count it twice. Households with none
 * are missing from the map. Capacity is the monthly figure of the profile, compared with the whole open
 * workload (the model has no per-month schedule of allocations).
 */
export async function committedByHousehold(
  em: EntityManager,
  householdIds: readonly string[],
  category: string | null | undefined,
  excludeRequestId?: string,
): Promise<Map<string, number>> {
  const committed = new Map<string, number>();
  if (!category || householdIds.length === 0) return committed;
  const rows = await em.find(
    OrderAllocation,
    {
      household: { $in: [...new Set(householdIds)] },
      status: { $in: [...COMMITTED_STATUSES] },
      quotation: {
        request: {
          status: { $in: [...COMMITTED_REQUEST_STATUSES] },
          category: category as ProductCategory,
          ...(excludeRequestId ? { id: { $ne: excludeRequestId } } : {}),
        },
      },
    },
    { populate: ['household'] },
  );
  for (const row of rows)
    committed.set(row.household.id, (committed.get(row.household.id) ?? 0) + row.quantity);
  return committed;
}

/**
 * BR-L6: throws `RFQ_CAPACITY_EXCEEDED` when `quantity` is above the household's declared capacity less
 * the `committed` quantity of its other active allocations.
 */
export function assertWithinCapacity(
  household: CapacityHolder,
  category: string | null | undefined,
  quantity: number,
  committed = 0,
): void {
  const capacity = declaredCapacity(household, category);
  if (!isWithinCapacity(quantity, remainingCapacity(capacity, committed)))
    throw new AppError(
      'RFQ_CAPACITY_EXCEEDED',
      `${quantity} is above the remaining ${category} capacity (${capacity} declared, ${committed} already allocated)`,
    );
}
