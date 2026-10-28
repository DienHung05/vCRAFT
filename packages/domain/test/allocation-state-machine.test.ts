import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALLOCATION_EVENTS,
  ALLOCATION_STATUSES,
  type AllocationEvent,
  type AllocationStatus,
  allocationStructuralEvents,
  allocationStructuralNext,
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
    it.each(ALLOCATION_EVENTS)('sự kiện %s: đúng bảng (tra cấu trúc)', (event) => {
      const expected = EXPECTED[state][event];
      const result = allocationStructuralNext(state, event);
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });
  });

  it('allocationTransition luôn chạy guard, không có đường tắt khi thiếu ctx', () => {
    const r = allocationTransition('IN_PROGRESS', 'COMPLETE', {});
    expect(r.ok).toBe(false);
    // sự kiện hợp lệ về cấu trúc nhưng có guard không thể qua bằng ctx rỗng
    expect(allocationStructuralNext('IN_PROGRESS', 'COMPLETE').ok).toBe(true);
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

  it('property: allocationStructuralEvents(s) chứa e ⇔ allocationStructuralNext(s, e) thành công', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOCATION_STATUSES),
        fc.constantFrom(...ALLOCATION_EVENTS),
        (s, e) => {
          expect(allocationStructuralEvents(s).includes(e)).toBe(allocationStructuralNext(s, e).ok);
        },
      ),
    );
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
        ctxArb,
        (s, e, ctx) => {
          expect(availableAllocationEvents(s, ctx).includes(e)).toBe(
            allocationTransition(s, e, ctx).ok,
          );
        },
      ),
    );
  });
});
