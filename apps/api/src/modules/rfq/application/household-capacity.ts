import { isWithinCapacity } from '@vcraft/domain';
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

/** BR-L6: throws `RFQ_CAPACITY_EXCEEDED` when `quantity` is above the household's declared capacity. */
export function assertWithinCapacity(
  household: CapacityHolder,
  category: string | null | undefined,
  quantity: number,
): void {
  const capacity = declaredCapacity(household, category);
  if (!isWithinCapacity(quantity, capacity))
    throw new AppError(
      'RFQ_CAPACITY_EXCEEDED',
      `${quantity} is above the declared ${category} capacity of ${capacity}`,
    );
}
