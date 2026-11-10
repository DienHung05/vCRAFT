import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type AllocationShare,
  allocationLateness,
  expectedShare,
  reallocate,
} from '../src/allocation';

const DAY = 86_400_000;
const start = new Date('2026-11-01T00:00:00Z');
const due = new Date(start.getTime() + 10 * DAY);
const at = (days: number) => new Date(start.getTime() + days * DAY);

describe('expectedShare', () => {
  it('is linear from start to due date and clamped outside', () => {
    expect(expectedShare(start, due, at(-1))).toBe(0);
    expect(expectedShare(start, due, at(5))).toBe(0.5);
    expect(expectedShare(start, due, at(12))).toBe(1);
  });
});

describe('allocationLateness', () => {
  const base = { quantity: 1000, startedAt: start, dueAt: due };

  it('a promised day stored as its end in Vietnam is not overdue during that day (GH#443)', () => {
    // "20 Nov" from a household: due 23:59:59 on 20 Nov in Vietnam, not 07:00.
    const promised = { ...base, completedQty: 999, dueAt: new Date('2026-11-20T16:59:59.000Z') };
    expect(allocationLateness(promised, new Date('2026-11-20T00:30:00.000Z')).status).not.toBe(
      'OVERDUE',
    );
    expect(allocationLateness(promised, new Date('2026-11-20T16:00:00.000Z')).status).not.toBe(
      'OVERDUE',
    );
    expect(allocationLateness(promised, new Date('2026-11-20T17:00:00.000Z')).status).toBe(
      'OVERDUE',
    );
  });

  it('is on track within 10% of the curve', () => {
    expect(allocationLateness({ ...base, completedQty: 450 }, at(5))).toEqual({
      status: 'ON_TRACK',
      expectedQty: 500,
      shortfall: 50,
    });
  });

  it('is behind beyond 10% of the curve', () => {
    expect(allocationLateness({ ...base, completedQty: 300 }, at(5)).status).toBe('BEHIND');
  });

  it('is overdue past the due date with pieces left, done when all are made', () => {
    expect(allocationLateness({ ...base, completedQty: 990 }, at(11)).status).toBe('OVERDUE');
    expect(allocationLateness({ ...base, completedQty: 1000 }, at(11)).status).toBe('DONE');
  });
});

describe('reallocate', () => {
  const order: AllocationShare[] = [
    { householdId: 'a', quantity: 600, completedQty: 200 },
    { householdId: 'b', quantity: 400, completedQty: 100 },
  ];

  it('keeps what the late household made and moves the rest', () => {
    const result = reallocate(order, 0, [
      { householdId: 'b', quantity: 150 },
      { householdId: 'c', quantity: 250 },
    ]);
    expect(result.ok && result.value).toEqual([
      { householdId: 'a', quantity: 200, completedQty: 200 },
      { householdId: 'b', quantity: 550, completedQty: 100 },
      { householdId: 'c', quantity: 250, completedQty: 0 },
    ]);
  });

  it('refuses targets that do not add up, repeat a household or name the late one', () => {
    const codeOf = (targets: { householdId: string; quantity: number }[]) => {
      const result = reallocate(order, 0, targets);
      return result.ok ? 'ok' : result.error.code;
    };
    expect(codeOf([{ householdId: 'c', quantity: 399 }])).toBe('SUM_MISMATCH');
    expect(codeOf([])).toBe('SUM_MISMATCH');
    expect(codeOf([{ householdId: 'a', quantity: 400 }])).toBe('INVALID_TARGETS');
    expect(
      codeOf([
        { householdId: 'c', quantity: 200 },
        { householdId: 'c', quantity: 200 },
      ]),
    ).toBe('INVALID_TARGETS');
    expect(
      codeOf([
        { householdId: 'c', quantity: 399.5 },
        { householdId: 'd', quantity: 0.5 },
      ]),
    ).toBe('INVALID_TARGETS');
  });

  it('refuses an allocation with nothing left', () => {
    const result = reallocate([{ householdId: 'a', quantity: 10, completedQty: 10 }], 0, [
      { householdId: 'b', quantity: 1 },
    ]);
    expect(!result.ok && result.error.code).toBe('NOTHING_LEFT');
  });

  // Property: for any order and any valid split of the remainder, the total never changes, the late
  // household keeps exactly what it made, nobody loses finished work, and households stay unique.
  it('keeps the order total invariant for any valid reallocation', () => {
    const household = fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f');
    const share = fc
      .record({
        quantity: fc.integer({ min: 1, max: 5000 }),
        done: fc.double({ min: 0, max: 1, noNaN: true }),
      })
      .map(({ quantity, done }) => ({ quantity, completedQty: Math.floor(quantity * done) }));
    const scenario = fc
      .uniqueArray(household, { minLength: 1, maxLength: 4 })
      .chain((ids) =>
        fc.tuple(
          fc.constant(ids),
          fc.array(share, { minLength: ids.length, maxLength: ids.length }),
          fc.nat({ max: ids.length - 1 }),
          fc.uniqueArray(household, { minLength: 1, maxLength: 3 }),
        ),
      );
    fc.assert(
      fc.property(scenario, ([ids, shares, index, targetIds]) => {
        const order = ids.map((householdId, i) => ({
          householdId,
          ...(shares[i] as { quantity: number; completedQty: number }),
        }));
        const late = order[index] as AllocationShare;
        const remaining = late.quantity - late.completedQty;
        const receivers = targetIds.filter((id) => id !== late.householdId);
        fc.pre(remaining >= receivers.length && receivers.length > 0);
        // Split the remainder into whole positive parts.
        const parts = receivers.map((householdId, i) => ({
          householdId,
          quantity:
            i === receivers.length - 1
              ? remaining - Math.floor(remaining / receivers.length) * (receivers.length - 1)
              : Math.floor(remaining / receivers.length),
        }));
        fc.pre(parts.every((p) => p.quantity > 0));
        const result = reallocate(order, index, parts);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const total = (rows: readonly AllocationShare[]) =>
          rows.reduce((s, r) => s + r.quantity, 0);
        expect(total(result.value)).toBe(total(order));
        expect(result.value[index]).toEqual({ ...late, quantity: late.completedQty });
        expect(result.value.every((r) => r.quantity >= r.completedQty)).toBe(true);
        expect(new Set(result.value.map((r) => r.householdId)).size).toBe(result.value.length);
      }),
    );
  });
});
