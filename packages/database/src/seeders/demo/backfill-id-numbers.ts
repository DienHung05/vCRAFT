import type { EntityManager } from '@mikro-orm/core';
import { FIELD_CONTEXTS, type FieldCipher } from '../../crypto/field-cipher.js';
import { Household } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_COUNT, demoHouseholdId, demoHouseholdIdNumber } from './seed-demo.js';

/**
 * Backfill of the fake citizen ID number for the demo households seeded before field encryption existed
 * (`household.id_number_enc` empty). A household is a demo household only when its id is one of the fixed
 * ids the demo seed gives its households ({@link demoHouseholdId}); nothing else is ever selected or written.
 */

export interface DemoHouseholdRow {
  readonly id: string;
  readonly slug: string;
  readonly idNumberEnc?: string | null;
}

export interface IdNumberBackfillTarget {
  readonly id: string;
  readonly slug: string;
  /** Index of the household in the demo seed, which decides its fake number. */
  readonly index: number;
}

export interface IdNumberBackfillOptions {
  /** Plan only: select the targets but write nothing. */
  readonly dryRun?: boolean;
  /** Touch at most this many households (the first ones by seed index). */
  readonly limit?: number;
  /** Touch only the household with this slug. */
  readonly slug?: string;
}

export interface IdNumberBackfillSummary {
  readonly dryRun: boolean;
  /** Demo households that exist in the database. */
  readonly demoHouseholds: number;
  /** Demo households whose ID number is already set (left untouched). */
  readonly alreadySet: number;
  /** Empty ones that matched the filters, i.e. would be (dry run) or were filled. */
  readonly selected: number;
  /** Rows actually written. Always 0 on a dry run. */
  readonly updated: number;
  /** Slugs of the selected households, never their numbers. */
  readonly slugs: readonly string[];
}

/** Fixed id of every demo household, mapped to its seed index. */
export function demoHouseholdIdIndex(): ReadonlyMap<string, number> {
  const map = new Map<string, number>();
  for (let index = 0; index < DEMO_HOUSEHOLD_COUNT; index++) map.set(demoHouseholdId(index), index);
  return map;
}

const isEmpty = (value: string | null | undefined) => value == null || value.trim() === '';

/**
 * Pure selection: from the rows read from the database, keep the demo households whose ID number is empty,
 * apply the `slug` and `limit` filters, and order by seed index so a `limit` is deterministic.
 */
export function selectIdNumberBackfillTargets(
  rows: readonly DemoHouseholdRow[],
  options: Pick<IdNumberBackfillOptions, 'limit' | 'slug'> = {},
): IdNumberBackfillTarget[] {
  const indexById = demoHouseholdIdIndex();
  const targets: IdNumberBackfillTarget[] = [];
  for (const row of rows) {
    const index = indexById.get(row.id);
    if (index === undefined || !isEmpty(row.idNumberEnc)) continue;
    if (options.slug !== undefined && row.slug !== options.slug) continue;
    targets.push({ id: row.id, slug: row.slug, index });
  }
  targets.sort((a, b) => a.index - b.index);
  return options.limit === undefined ? targets : targets.slice(0, Math.max(0, options.limit));
}

/**
 * Fill the empty ID numbers of demo households with the same fake number the seed uses, encrypted with the
 * current key. Idempotent: a household that already has a value is never selected, and the write itself only
 * matches a still-empty column, so a concurrent run cannot overwrite a value.
 */
export async function backfillDemoIdNumbers(
  em: EntityManager,
  cipher: FieldCipher,
  options: IdNumberBackfillOptions = {},
): Promise<IdNumberBackfillSummary> {
  const dryRun = options.dryRun === true;
  const rows = await em.find(
    Household,
    { id: { $in: [...demoHouseholdIdIndex().keys()] } },
    { fields: ['id', 'slug', 'idNumberEnc'] },
  );
  const targets = selectIdNumberBackfillTargets(rows, options);
  const emptyAll = selectIdNumberBackfillTargets(rows);

  let updated = 0;
  if (!dryRun) {
    for (const target of targets) {
      updated += await em.nativeUpdate(
        Household,
        { id: target.id, $or: [{ idNumberEnc: null }, { idNumberEnc: '' }] },
        {
          idNumberEnc: cipher.encrypt(
            demoHouseholdIdNumber(target.index),
            FIELD_CONTEXTS.householdIdNumber,
          ),
        },
      );
    }
  }
  return {
    dryRun,
    demoHouseholds: rows.length,
    alreadySet: rows.length - emptyAll.length,
    selected: targets.length,
    updated,
    slugs: targets.map((target) => target.slug),
  };
}
