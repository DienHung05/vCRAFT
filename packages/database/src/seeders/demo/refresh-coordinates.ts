import type { EntityManager } from '@mikro-orm/core';
import { Workshop } from '../../entities/index.js';
import { fitCoordinateStrings } from './boundary-fit.js';
import { DEMO_HOUSEHOLD_COUNT, demoEntityId } from './seed-demo.js';

/**
 * GH#396: moves the seeded demo workshop pins that lie outside the Bát Tràng commune polygon to the nearest
 * point inside it (see `boundary-fit.ts`), so a live demo database matches the current seed without a reset.
 * Only `workshop.lat` and `workshop.lng` of the workshops with deterministic demo ids are written; nothing else
 * is touched. Idempotent: a pin already inside is left alone, so a second run reports `changed: 0`.
 */

export interface RefreshCoordinatesOptions {
  /** Compute and report the changes but write nothing. */
  readonly dryRun?: boolean;
}

export interface RefreshCoordinatesReport {
  readonly dryRun: boolean;
  /** Demo workshops found in the database. */
  readonly found: number;
  readonly changed: number;
  readonly unchanged: number;
  /** Ids of the workshops whose pin moved. */
  readonly changedWorkshopIds: readonly string[];
}

/** Every id the seed can give a workshop (at most two per household), whether or not the row exists. */
export function demoWorkshopIds(): string[] {
  const ids: string[] = [];
  for (let index = 0; index < DEMO_HOUSEHOLD_COUNT; index++) {
    for (let w = 0; w < 2; w++) ids.push(demoEntityId('workshop', `${index}-${w}`));
  }
  return ids;
}

export async function refreshDemoCoordinates(
  em: EntityManager,
  options: RefreshCoordinatesOptions = {},
): Promise<RefreshCoordinatesReport> {
  const dryRun = options.dryRun === true;
  const changedWorkshopIds: string[] = [];
  let found = 0;
  await em.transactional(async (tx) => {
    const workshops = await tx.find(Workshop, { id: { $in: demoWorkshopIds() } });
    found = workshops.length;
    for (const workshop of workshops) {
      if (workshop.lat == null || workshop.lng == null) continue;
      const fitted = fitCoordinateStrings(workshop.lat, workshop.lng);
      if (fitted.lat === workshop.lat && fitted.lng === workshop.lng) continue;
      changedWorkshopIds.push(workshop.id);
      if (!dryRun) {
        workshop.lat = fitted.lat;
        workshop.lng = fitted.lng;
      }
    }
  });
  return {
    dryRun,
    found,
    changed: changedWorkshopIds.length,
    unchanged: found - changedWorkshopIds.length,
    changedWorkshopIds,
  };
}
