import type { EntityManager } from '@mikro-orm/core';
import { Household } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_COUNT, demoHouseholdId } from './seed-demo.js';
import type { DemoCheck } from './verify.js';

/** The ids of every seed household (approved ones and the pending one). */
export function demoHouseholdIdSet(): ReadonlySet<string> {
  return new Set(
    Array.from({ length: DEMO_HOUSEHOLD_COUNT }, (_, index) => demoHouseholdId(index)),
  );
}

/** Approved households that are not part of the demo seed: leftovers of manual testing (GH#474). */
export function strayApprovedHouseholds<T extends { id: string }>(
  approved: readonly T[],
  seedIds: ReadonlySet<string> = demoHouseholdIdSet(),
): T[] {
  return approved.filter((household) => !seedIds.has(household.id));
}

/**
 * `demo:verify` check: no APPROVED household exists outside the seed, since it would be public on the
 * village page and the map during the exam. Read-only.
 */
export async function checkNoStrayApprovedHouseholds(em: EntityManager): Promise<DemoCheck> {
  const approved = await em.find(
    Household,
    { status: 'APPROVED' },
    { fields: ['id', 'slug'], orderBy: { slug: 'asc' } },
  );
  const stray = strayApprovedHouseholds(approved);
  return {
    name: 'Không có hộ APPROVED ngoài dữ liệu seed',
    ok: stray.length === 0,
    detail:
      stray.length === 0
        ? 'mọi hộ đã duyệt đều thuộc seed'
        : `${stray.length} hộ lạ: ${stray
            .slice(0, 5)
            .map((household) => household.slug)
            .join(', ')}`,
  };
}
