import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  availableBidEvents,
  BID_EVENTS,
  BID_STATUSES,
  type BidEvent,
  type BidStatus,
  bidStructuralEvents,
  bidStructuralNext,
  bidTransition,
  canReviseBid,
  RFQ_STATUSES,
} from '../src';

/** SRS §4.2 */
const EXPECTED: Record<BidStatus, Partial<Record<BidEvent, BidStatus>>> = {
  SUBMITTED: {
    REVISE: 'SUBMITTED',
    ACCEPT: 'ACCEPTED',
    REJECT: 'REJECTED',
    WITHDRAW: 'WITHDRAWN',
    LAPSE: 'LAPSED',
  },
  ACCEPTED: {},
  REJECTED: {},
  WITHDRAWN: {},
  LAPSED: {},
};

const NOW = new Date('2026-01-10T00:00:00.000Z');
const open = {
  rfqStatus: 'BIDDING',
  biddingClosesAt: new Date(NOW.getTime() + 1000),
  now: NOW,
} as const;

describe('Bid state machine (SRS §4.2)', () => {
  describe.each(BID_STATUSES)('từ %s', (state) => {
    it.each(BID_EVENTS)('sự kiện %s: đúng bảng (tra cấu trúc)', (event) => {
      const expected = EXPECTED[state][event];
      const result = bidStructuralNext(state, event);
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });
  });

  it('BR-L4: REVISE bị khóa khi hết hạn hoặc RFQ không ở SENT/BIDDING', () => {
    expect(bidTransition('SUBMITTED', 'REVISE', open).ok).toBe(true);
    const closed = bidTransition('SUBMITTED', 'REVISE', { ...open, now: open.biddingClosesAt });
    expect(closed.ok).toBe(false);
    if (!closed.ok) expect(closed.error.code).toBe('BID_LOCKED');
    for (const rfqStatus of RFQ_STATUSES) {
      const ok = rfqStatus === 'SENT' || rfqStatus === 'BIDDING';
      expect(bidTransition('SUBMITTED', 'REVISE', { ...open, rfqStatus }).ok).toBe(ok);
    }
  });

  it('thiếu ngữ cảnh ⇒ MISSING_CONTEXT', () => {
    const r = bidTransition('SUBMITTED', 'REVISE', {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_CONTEXT');
  });

  it('REVISE không có đường tắt bỏ guard: ctx rỗng ⇒ MISSING_CONTEXT dù cấu trúc cho phép', () => {
    expect(bidStructuralNext('SUBMITTED', 'REVISE').ok).toBe(true);
    expect(bidTransition('SUBMITTED', 'REVISE', {}).ok).toBe(false);
    expect(availableBidEvents('SUBMITTED', {})).not.toContain('REVISE');
  });

  it('property: bidStructuralEvents(s) chứa e ⇔ bidStructuralNext(s, e) thành công', () => {
    fc.assert(
      fc.property(fc.constantFrom(...BID_STATUSES), fc.constantFrom(...BID_EVENTS), (s, e) => {
        expect(bidStructuralEvents(s).includes(e)).toBe(bidStructuralNext(s, e).ok);
      }),
    );
  });

  it('property: availableBidEvents(s, ctx) chứa e ⇔ bidTransition(s, e, ctx) thành công', () => {
    fc.assert(
      fc.property(fc.constantFrom(...BID_STATUSES), fc.constantFrom(...BID_EVENTS), (s, e) => {
        expect(availableBidEvents(s, open).includes(e)).toBe(bidTransition(s, e, open).ok);
      }),
    );
  });

  it('property: canReviseBid ⇔ RFQ ∈ {SENT, BIDDING} ∧ now < hạn', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RFQ_STATUSES),
        fc.integer({ min: -1000, max: 1000 }),
        (rfqStatus, delta) => {
          const closes = new Date(NOW.getTime() + delta);
          expect(canReviseBid(rfqStatus, closes, NOW)).toBe(
            (rfqStatus === 'SENT' || rfqStatus === 'BIDDING') && delta > 0,
          );
        },
      ),
    );
  });
});
