import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALLOCATION_EVENTS,
  ALLOCATION_STATUSES,
  type AllocationEvent,
  type AllocationStatus,
  allocationTransition,
  availableAllocationEvents,
} from '../src';

/** SRS §4.3 */
const EXPECTED: Record<AllocationStatus, Partial<Record<AllocationEvent, AllocationStatus>>> = {
  PROPOSED: { CONFIRM: 'CONFIRMED', DECLINE: 'DECLINED', CANCEL: 'CANCELLED' },
  CONFIRMED: { START: 'IN_PROGRESS', CANCEL: 'CANCELLED' },
  IN_PROGRESS: { COMPLETE: 'DONE', CANCEL: 'CANCELLED' },
  DECLINED: {},
  DONE: {},
  CANCELLED: {},
};

describe('Allocation state machine (SRS §4.3)', () => {
  describe.each(ALLOCATION_STATUSES)('từ %s', (state) => {
    it.each(ALLOCATION_EVENTS)('sự kiện %s: đúng bảng', (event) => {
      const expected = EXPECTED[state][event];
      const result = allocationTransition(state, event);
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });
  });

  it('COMPLETE chỉ khi completedQty = quantity', () => {
    expect(
      allocationTransition('IN_PROGRESS', 'COMPLETE', { quantity: 10, completedQty: 10 }).ok,
    ).toBe(true);
    const short = allocationTransition('IN_PROGRESS', 'COMPLETE', {
      quantity: 10,
      completedQty: 9,
    });
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error.code).toBe('ALLOCATION_NOT_COMPLETE');
    const missing = allocationTransition('IN_PROGRESS', 'COMPLETE', {});
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('MISSING_CONTEXT');
  });

  it('property: availableAllocationEvents(s, ctx) chứa e ⇔ allocationTransition(s, e, ctx) thành công', () => {
    const ctxArb = fc.record({
      quantity: fc.integer({ min: 1, max: 5 }),
      completedQty: fc.integer({ min: 0, max: 5 }),
    });
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOCATION_STATUSES),
        fc.constantFrom(...ALLOCATION_EVENTS),
        fc.option(ctxArb, { nil: undefined }),
        (s, e, ctx) => {
          expect(availableAllocationEvents(s, ctx).includes(e)).toBe(
            allocationTransition(s, e, ctx).ok,
          );
        },
      ),
    );
  });
});
