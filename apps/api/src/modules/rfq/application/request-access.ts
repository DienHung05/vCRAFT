import type { EntityManager } from '@mikro-orm/core';
import { Household, type QuotationRequest } from '@vcraft/database';
import type { Actor } from '../../../common/auth/auth.guard';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';

/** The coordinating admin of a coordinated request; anyone else gets 404. */
export function assertCoordinator(actor: Actor, request: QuotationRequest) {
  if (actor.role !== 'ADMIN' || request.coordinatorId !== actor.id || !request.coordinationOptIn)
    throw notFound();
  if (actor.locked) throw forbidden();
}

/** The coordinator of a coordinated request; any admin for a request nobody coordinates (T7 names "Admin"). */
export function assertCoordinatorOrBoard(actor: Actor, request: QuotationRequest) {
  if (request.coordinationOptIn) return assertCoordinator(actor, request);
  if (actor.role !== 'ADMIN') throw notFound();
  if (actor.locked) throw forbidden();
}

/** Every household must exist, be approved and have a representative who is not locked. */
export async function assertEligibleHouseholds(em: EntityManager, ids: readonly string[]) {
  const uniqueIds = [...new Set(ids)];
  const households = await em.find(
    Household,
    { id: { $in: uniqueIds } },
    { populate: ['representative'] },
  );
  if (
    households.length !== uniqueIds.length ||
    households.some((h) => h.status !== 'APPROVED' || h.representative.status === 'LOCKED')
  ) {
    throw new AppError('RFQ_ARTISAN_NOT_ELIGIBLE');
  }
}
