import { randomBytes } from 'node:crypto';
import type { EntityManager } from '@mikro-orm/core';
import { describe, expect, it } from 'vitest';
import {
  backfillDemoIdNumbers,
  DEMO_HOUSEHOLD_COUNT,
  DEMO_HOUSEHOLD_IDS,
  demoHouseholdId,
  demoHouseholdIdIndex,
  demoHouseholdIdNumber,
  FIELD_CONTEXTS,
  FieldCipher,
  selectIdNumberBackfillTargets,
} from '../src';

const cipher = () => new FieldCipher(`v1:${randomBytes(32).toString('base64')}`);

const row = (index: number, idNumberEnc?: string | null) => ({
  id: demoHouseholdId(index),
  slug: `ho-${index}`,
  idNumberEnc,
});

describe('demo household ids', () => {
  it('maps every seed index to a distinct fixed id, reusing the fixed ids of the two named households', () => {
    const ids = [...demoHouseholdIdIndex().keys()];
    expect(ids).toHaveLength(DEMO_HOUSEHOLD_COUNT);
    expect(new Set(ids).size).toBe(DEMO_HOUSEHOLD_COUNT);
    expect(demoHouseholdId(2)).toBe(DEMO_HOUSEHOLD_IDS.household);
    expect(demoHouseholdId(DEMO_HOUSEHOLD_COUNT - 1)).toBe(DEMO_HOUSEHOLD_IDS.pending);
  });

  it('derives the obviously fake number: eight zeros, then the household number', () => {
    expect(demoHouseholdIdNumber(0)).toBe('000000000000');
    expect(demoHouseholdIdNumber(7)).toBe('000000000007');
    expect(demoHouseholdIdNumber(20)).toBe('000000000020');
  });
});

describe('selectIdNumberBackfillTargets', () => {
  it('selects only demo households with an empty ID number, in seed order', () => {
    const targets = selectIdNumberBackfillTargets([
      row(5, null),
      row(1, 'v1:already:sealed:value'),
      row(3, ''),
      row(0),
      row(2, '   '),
    ]);
    expect(targets.map((target) => target.index)).toEqual([0, 2, 3, 5]);
  });

  it('never selects a row whose id is not a demo household id', () => {
    const stranger = {
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'ho-that',
      idNumberEnc: null,
    };
    expect(selectIdNumberBackfillTargets([stranger, row(4, null)]).map((t) => t.slug)).toEqual([
      'ho-4',
    ]);
  });

  it('applies the slug and limit filters', () => {
    const rows = [row(0), row(1), row(2), row(3)];
    expect(selectIdNumberBackfillTargets(rows, { slug: 'ho-2' }).map((t) => t.index)).toEqual([2]);
    expect(selectIdNumberBackfillTargets(rows, { limit: 2 }).map((t) => t.index)).toEqual([0, 1]);
    expect(selectIdNumberBackfillTargets(rows, { slug: 'nope' })).toEqual([]);
  });
});

/** Minimal in-memory stand-in for the two EntityManager calls the backfill makes. */
function fakeEm(initial: Array<{ id: string; slug: string; idNumberEnc?: string | null }>) {
  const store = initial.map((item) => ({ ...item }));
  const em = {
    find: async (_entity: unknown, where: { id: { $in: string[] } }) =>
      store.filter((item) => where.id.$in.includes(item.id)).map((item) => ({ ...item })),
    nativeUpdate: async (
      _entity: unknown,
      where: { id: string },
      data: { idNumberEnc: string },
    ) => {
      const target = store.find((item) => item.id === where.id && !item.idNumberEnc);
      if (!target) return 0;
      target.idNumberEnc = data.idNumberEnc;
      return 1;
    },
  };
  return { em: em as unknown as EntityManager, store };
}

describe('backfillDemoIdNumbers', () => {
  const stranger = {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'ho-that',
    idNumberEnc: null,
  };
  const seeded = () => [row(0, null), row(1, null), row(2, 'v1:keep:me:as-is'), stranger];

  it('writes nothing on a dry run but reports what it would do', async () => {
    const { em, store } = fakeEm(seeded());
    const summary = await backfillDemoIdNumbers(em, cipher(), { dryRun: true });
    expect(summary).toMatchObject({
      dryRun: true,
      demoHouseholds: 3,
      alreadySet: 1,
      selected: 2,
      updated: 0,
      slugs: ['ho-0', 'ho-1'],
    });
    expect(store.filter((item) => item.idNumberEnc).length).toBe(1);
  });

  it('encrypts the same number the seed derives, leaves set and non-demo rows alone, and is idempotent', async () => {
    const key = cipher();
    const { em, store } = fakeEm(seeded());
    const first = await backfillDemoIdNumbers(em, key);
    expect(first).toMatchObject({ selected: 2, updated: 2 });

    const byId = new Map(store.map((item) => [item.id, item.idNumberEnc]));
    expect(
      key.decrypt(byId.get(demoHouseholdId(0)) as string, FIELD_CONTEXTS.householdIdNumber),
    ).toBe(demoHouseholdIdNumber(0));
    expect(
      key.decrypt(byId.get(demoHouseholdId(1)) as string, FIELD_CONTEXTS.householdIdNumber),
    ).toBe(demoHouseholdIdNumber(1));
    expect(byId.get(demoHouseholdId(2))).toBe('v1:keep:me:as-is');
    expect(byId.get(stranger.id)).toBeNull();

    const second = await backfillDemoIdNumbers(em, key);
    expect(second).toMatchObject({ selected: 0, updated: 0, alreadySet: 3 });
  });

  it('honours --limit', async () => {
    const { em, store } = fakeEm(seeded());
    const summary = await backfillDemoIdNumbers(em, cipher(), { limit: 1 });
    expect(summary).toMatchObject({ selected: 1, updated: 1, slugs: ['ho-0'] });
    expect(store.filter((item) => item.idNumberEnc).length).toBe(2);
  });
});
