import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  type AllocationStatus,
  availableEvents,
  DomainError,
  isRfqTerminal,
  RFQ_ACCEPT_GRACE_MS,
  RFQ_ACTOR_ROLES,
  RFQ_EVENTS,
  RFQ_MIN_BIDDING_WINDOW_MS,
  RFQ_STATUSES,
  type RfqActorRole,
  type RfqContext,
  type RfqEvent,
  type RfqStatus,
  transition,
} from '../src';

/** Bảng kỳ vọng viết tay từ SRS §4.1 — độc lập với bảng trong mã nguồn. */
const EXPECTED: Record<RfqStatus, Partial<Record<RfqEvent, RfqStatus>>> = {
  DRAFT: { SUBMIT: 'SENT', CANCEL: 'CANCELLED' },
  SENT: { RECEIVE_BID: 'BIDDING', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  BIDDING: { ACCEPT_BID: 'ACCEPTED', CANCEL: 'CANCELLED', EXPIRE: 'EXPIRED' },
  ACCEPTED: { START_PRODUCTION: 'IN_PRODUCTION', ADMIN_CANCEL: 'CANCELLED' },
  IN_PRODUCTION: { CONFIRM_DELIVERY: 'DELIVERED' },
  DELIVERED: {},
  CANCELLED: {},
  EXPIRED: {},
};

const NOW = new Date('2026-01-10T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

/** Ngữ cảnh "mọi guard đều thỏa" cho cặp (state, event) hợp lệ. */
function validCtx(state: RfqStatus, event: RfqEvent): RfqContext {
  const actor: Record<RfqEvent, RfqActorRole> = {
    SUBMIT: 'BUYER_OWNER',
    RECEIVE_BID: 'ARTISAN',
    ACCEPT_BID: 'BUYER_OWNER',
    START_PRODUCTION: 'ADMIN',
    CONFIRM_DELIVERY: 'BUYER_OWNER',
    CANCEL: 'BUYER_OWNER',
    ADMIN_CANCEL: 'ADMIN',
    EXPIRE: 'SYSTEM',
  };
  const biddingClosesAt = state === 'DRAFT' ? at(48 * HOUR) : at(-8 * 24 * HOUR);
  return {
    actor: actor[event],
    now: event === 'RECEIVE_BID' ? at(-HOUR) : NOW,
    emailVerified: true,
    biddingClosesAt: event === 'RECEIVE_BID' ? NOW : biddingClosesAt,
    requiredBy: at(30 * 24 * HOUR),
    quantity: 5000,
    hasBidFromArtisan: false,
    bid: { status: 'SUBMITTED', quantityOffered: 5000 },
    allocationStatuses: [event === 'CONFIRM_DELIVERY' ? 'DONE' : 'CONFIRMED'],
    reason: 'lý do hợp lệ',
  };
}

describe('RFQ state machine: bảng chuyển trạng thái (SRS §4.1)', () => {
  it('liệt kê đủ 8 trạng thái và 8 sự kiện', () => {
    expect(RFQ_STATUSES).toHaveLength(8);
    expect(RFQ_EVENTS).toHaveLength(8);
  });

  describe.each(RFQ_STATUSES)('từ %s', (state) => {
    it.each(RFQ_EVENTS)('sự kiện %s (không ctx): đúng bảng', (event) => {
      const expected = EXPECTED[state][event];
      const result = transition(state, event);
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBeInstanceOf(DomainError);
          expect(result.error.code).toBe('INVALID_TRANSITION');
          expect(result.error.details).toMatchObject({ from: state, event });
        }
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });

    it.each(RFQ_EVENTS)('sự kiện %s (ctx hợp lệ): đúng bảng', (event) => {
      const expected = EXPECTED[state][event];
      const result = transition(state, event, validCtx(state, event));
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });

    it('availableEvents khớp bảng (không ctx và ctx hợp lệ)', () => {
      const expected = RFQ_EVENTS.filter((e) => EXPECTED[state][e] !== undefined);
      expect(availableEvents(state)).toEqual(expected);
      for (const event of expected) {
        expect(availableEvents(state, validCtx(state, event))).toContain(event);
      }
    });

    it('isRfqTerminal đúng với trạng thái không có sự kiện đi ra', () => {
      expect(isRfqTerminal(state)).toBe(Object.keys(EXPECTED[state]).length === 0);
    });
  });

  it('DELIVERED, CANCELLED, EXPIRED là trạng thái kết thúc', () => {
    for (const s of ['DELIVERED', 'CANCELLED', 'EXPIRED'] as const) {
      expect(availableEvents(s)).toEqual([]);
    }
  });
});

describe('RFQ guards (SRS §4.1 cột "Điều kiện")', () => {
  const run = (state: RfqStatus, event: RfqEvent, patch: Partial<RfqContext>) =>
    transition(state, event, { ...validCtx(state, event), ...patch });
  const codeOf = (r: ReturnType<typeof transition>) => (r.ok ? 'OK' : r.error.code);

  it('thiếu dữ kiện cần cho guard ⇒ MISSING_CONTEXT (không ngầm cho qua)', () => {
    expect(codeOf(transition('DRAFT', 'SUBMIT', {}))).toBe('MISSING_CONTEXT');
    expect(codeOf(run('BIDDING', 'ACCEPT_BID', { bid: undefined }))).toBe('MISSING_CONTEXT');
  });

  it('tác nhân sai ⇒ ACTOR_NOT_ALLOWED trên mọi cặp hợp lệ', () => {
    for (const state of RFQ_STATUSES) {
      for (const event of RFQ_EVENTS) {
        if (EXPECTED[state][event] === undefined) continue;
        const allowed = RFQ_ACTOR_ROLES.filter(
          (actor) => transition(state, event, { ...validCtx(state, event), actor }).ok,
        );
        expect(allowed.length).toBeGreaterThan(0);
        for (const actor of RFQ_ACTOR_ROLES) {
          const r = transition(state, event, { ...validCtx(state, event), actor });
          expect(codeOf(r) === 'ACTOR_NOT_ALLOWED').toBe(!allowed.includes(actor));
        }
      }
    }
  });

  describe('T1 SUBMIT', () => {
    it('email chưa xác minh', () => {
      expect(codeOf(run('DRAFT', 'SUBMIT', { emailVerified: false }))).toBe('EMAIL_NOT_VERIFIED');
    });
    it('biddingClosesAt phải ≥ now + 24h (biên chính xác)', () => {
      const edge = at(RFQ_MIN_BIDDING_WINDOW_MS);
      expect(codeOf(run('DRAFT', 'SUBMIT', { biddingClosesAt: edge }))).toBe('OK');
      expect(
        codeOf(run('DRAFT', 'SUBMIT', { biddingClosesAt: at(RFQ_MIN_BIDDING_WINDOW_MS - 1) })),
      ).toBe('BIDDING_DEADLINE_TOO_SOON');
    });
    it('requiredBy phải > biddingClosesAt (biên chính xác)', () => {
      const closes = at(48 * HOUR);
      expect(codeOf(run('DRAFT', 'SUBMIT', { biddingClosesAt: closes, requiredBy: closes }))).toBe(
        'DELIVERY_BEFORE_BIDDING_DEADLINE',
      );
      expect(
        codeOf(run('DRAFT', 'SUBMIT', { biddingClosesAt: closes, requiredBy: at(48 * HOUR + 1) })),
      ).toBe('OK');
    });
  });

  describe('T2 RECEIVE_BID', () => {
    it('chỉ khi now < biddingClosesAt (biên chính xác)', () => {
      expect(codeOf(run('SENT', 'RECEIVE_BID', { now: NOW, biddingClosesAt: at(1) }))).toBe('OK');
      expect(codeOf(run('SENT', 'RECEIVE_BID', { now: NOW, biddingClosesAt: NOW }))).toBe(
        'BIDDING_CLOSED',
      );
    });
    it('BR-L3: hộ đã có bid ⇒ DUPLICATE_BID', () => {
      expect(codeOf(run('SENT', 'RECEIVE_BID', { hasBidFromArtisan: true }))).toBe('DUPLICATE_BID');
    });
    it('Admin (bid của BQL) cũng được phép', () => {
      expect(codeOf(run('SENT', 'RECEIVE_BID', { actor: 'ADMIN' }))).toBe('OK');
    });
  });

  describe('T3 ACCEPT_BID', () => {
    it('bid không còn SUBMITTED', () => {
      for (const status of ['ACCEPTED', 'REJECTED', 'WITHDRAWN', 'LAPSED'] as const) {
        expect(
          codeOf(run('BIDDING', 'ACCEPT_BID', { bid: { status, quantityOffered: 5000 } })),
        ).toBe('BID_NOT_SUBMITTED');
      }
    });
    it('quantityOffered phải bằng quantity', () => {
      expect(
        codeOf(
          run('BIDDING', 'ACCEPT_BID', { bid: { status: 'SUBMITTED', quantityOffered: 4999 } }),
        ),
      ).toBe('BID_QUANTITY_MISMATCH');
    });
    it('chỉ Buyer chủ RFQ chốt được', () => {
      expect(codeOf(run('BIDDING', 'ACCEPT_BID', { actor: 'ADMIN' }))).toBe('ACTOR_NOT_ALLOWED');
    });
  });

  describe('T4 START_PRODUCTION / T5 CONFIRM_DELIVERY', () => {
    const cases: [AllocationStatus[], boolean][] = [
      [[], false],
      [['CONFIRMED'], true],
      [['CONFIRMED', 'PROPOSED'], false],
      [['CONFIRMED', 'CONFIRMED'], true],
    ];
    it.each(cases)('T4 allocations %j ⇒ hợp lệ=%s', (allocationStatuses, valid) => {
      expect(codeOf(run('ACCEPTED', 'START_PRODUCTION', { allocationStatuses }))).toBe(
        valid ? 'OK' : 'ALLOCATIONS_NOT_CONFIRMED',
      );
    });
    it('T5 cần mọi Allocation DONE', () => {
      const ok = run('IN_PRODUCTION', 'CONFIRM_DELIVERY', { allocationStatuses: ['DONE', 'DONE'] });
      expect(codeOf(ok)).toBe('OK');
      expect(
        codeOf(
          run('IN_PRODUCTION', 'CONFIRM_DELIVERY', { allocationStatuses: ['DONE', 'IN_PROGRESS'] }),
        ),
      ).toBe('ALLOCATIONS_NOT_DONE');
      expect(codeOf(run('IN_PRODUCTION', 'CONFIRM_DELIVERY', { allocationStatuses: [] }))).toBe(
        'ALLOCATIONS_NOT_DONE',
      );
    });
    it('hộ được START_PRODUCTION, nhưng không được CONFIRM_DELIVERY', () => {
      expect(codeOf(run('ACCEPTED', 'START_PRODUCTION', { actor: 'ARTISAN' }))).toBe('OK');
      expect(codeOf(run('IN_PRODUCTION', 'CONFIRM_DELIVERY', { actor: 'ARTISAN' }))).toBe(
        'ACTOR_NOT_ALLOWED',
      );
    });
  });

  describe('T6 CANCEL / T7 ADMIN_CANCEL', () => {
    it('DRAFT hủy không cần lý do', () => {
      expect(codeOf(transition('DRAFT', 'CANCEL', { actor: 'BUYER_OWNER' }))).toBe('OK');
    });
    it.each(['SENT', 'BIDDING'] as const)('%s hủy bắt buộc lý do', (state) => {
      expect(codeOf(run(state, 'CANCEL', { reason: '' }))).toBe('REASON_REQUIRED');
      expect(codeOf(run(state, 'CANCEL', { reason: '   ' }))).toBe('REASON_REQUIRED');
      expect(codeOf(run(state, 'CANCEL', { reason: 'đổi kế hoạch' }))).toBe('OK');
    });
    it('T7 chỉ Admin và bắt buộc lý do', () => {
      expect(codeOf(run('ACCEPTED', 'ADMIN_CANCEL', { reason: '' }))).toBe('REASON_REQUIRED');
      expect(codeOf(run('ACCEPTED', 'ADMIN_CANCEL', { actor: 'BUYER_OWNER' }))).toBe(
        'ACTOR_NOT_ALLOWED',
      );
    });
    it('Buyer không CANCEL được khi đã ACCEPTED (phải qua Admin)', () => {
      expect(codeOf(transition('ACCEPTED', 'CANCEL', { actor: 'BUYER_OWNER' }))).toBe(
        'INVALID_TRANSITION',
      );
    });
  });

  describe('T8 EXPIRE', () => {
    const closes = at(-HOUR);
    it('SENT: now ≥ biddingClosesAt (biên chính xác)', () => {
      expect(codeOf(run('SENT', 'EXPIRE', { biddingClosesAt: NOW }))).toBe('OK');
      expect(codeOf(run('SENT', 'EXPIRE', { biddingClosesAt: at(1) }))).toBe('NOT_YET_EXPIRED');
    });
    it('BIDDING: now ≥ biddingClosesAt + 7 ngày (biên chính xác)', () => {
      const exact = at(-RFQ_ACCEPT_GRACE_MS);
      expect(codeOf(run('BIDDING', 'EXPIRE', { biddingClosesAt: exact }))).toBe('OK');
      expect(
        codeOf(run('BIDDING', 'EXPIRE', { biddingClosesAt: at(-RFQ_ACCEPT_GRACE_MS + 1) })),
      ).toBe('NOT_YET_EXPIRED');
      expect(codeOf(run('BIDDING', 'EXPIRE', { biddingClosesAt: closes }))).toBe('NOT_YET_EXPIRED');
    });
    it('chỉ SYSTEM', () => {
      expect(codeOf(run('SENT', 'EXPIRE', { biddingClosesAt: NOW, actor: 'ADMIN' }))).toBe(
        'ACTOR_NOT_ALLOWED',
      );
    });
  });

  describe('availableEvents theo tác nhân (FR-RFQ-12)', () => {
    it('Buyer chủ RFQ ở BIDDING thấy ACCEPT_BID và CANCEL, không thấy EXPIRE', () => {
      expect(availableEvents('BIDDING', { actor: 'BUYER_OWNER' })).toEqual([
        'ACCEPT_BID',
        'CANCEL',
      ]);
    });
    it('hộ ở SENT (còn hạn) chỉ thấy RECEIVE_BID', () => {
      expect(
        availableEvents('SENT', { actor: 'ARTISAN', now: NOW, biddingClosesAt: at(HOUR) }),
      ).toEqual(['RECEIVE_BID']);
      expect(
        availableEvents('SENT', { actor: 'ARTISAN', now: NOW, biddingClosesAt: at(-HOUR) }),
      ).toEqual([]);
    });
    it('nút CANCEL vẫn hiện khi chưa nhập lý do', () => {
      expect(availableEvents('SENT', { actor: 'BUYER_OWNER' })).toContain('CANCEL');
    });
  });
});

describe('RFQ state machine: property tests', () => {
  const dateArb = fc
    .integer({ min: -10 * 24 * HOUR, max: 10 * 24 * HOUR })
    .map((offset) => at(offset));
  const ctxArb = fc.record({
    actor: fc.constantFrom(...RFQ_ACTOR_ROLES),
    now: dateArb,
    emailVerified: fc.boolean(),
    biddingClosesAt: dateArb,
    requiredBy: dateArb,
    quantity: fc.integer({ min: 1, max: 10 }),
    hasBidFromArtisan: fc.boolean(),
    bid: fc.record({
      status: fc.constantFrom('SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'LAPSED'),
      quantityOffered: fc.integer({ min: 1, max: 10 }),
    }),
    allocationStatuses: fc.array(
      fc.constantFrom<AllocationStatus>(
        'PROPOSED',
        'CONFIRMED',
        'DECLINED',
        'IN_PROGRESS',
        'DONE',
        'CANCELLED',
      ),
      { maxLength: 4 },
    ),
    reason: fc.string(),
  }) satisfies fc.Arbitrary<RfqContext>;
  const stateArb = fc.constantFrom(...RFQ_STATUSES);
  const eventArb = fc.constantFrom(...RFQ_EVENTS);

  it('không ctx: availableEvents(s) chứa e ⇔ transition(s, e) thành công', () => {
    fc.assert(
      fc.property(stateArb, eventArb, (s, e) => {
        expect(availableEvents(s).includes(e)).toBe(transition(s, e).ok);
      }),
    );
  });

  it('có ctx đầy đủ: transition thành công ⇒ e ∈ availableEvents(s, ctx)', () => {
    fc.assert(
      fc.property(stateArb, eventArb, ctxArb, (s, e, ctx) => {
        if (transition(s, e, ctx).ok) expect(availableEvents(s, ctx)).toContain(e);
      }),
    );
  });

  it('có ctx đầy đủ: e ∈ availableEvents(s, ctx) ⇔ transition không bị chặn bởi INVALID_TRANSITION/tác nhân/guard khả dụng', () => {
    // Lỗi duy nhất mà một sự kiện "khả dụng" vẫn có thể gặp là lỗi dữ liệu nhập (inputGuards).
    const INPUT_ERRORS = new Set([
      'BIDDING_DEADLINE_TOO_SOON',
      'DELIVERY_BEFORE_BIDDING_DEADLINE',
      'DUPLICATE_BID',
      'BID_NOT_SUBMITTED',
      'BID_QUANTITY_MISMATCH',
      'REASON_REQUIRED',
    ]);
    fc.assert(
      fc.property(stateArb, eventArb, ctxArb, (s, e, ctx) => {
        const r = transition(s, e, ctx);
        const available = availableEvents(s, ctx).includes(e);
        expect(available).toBe(r.ok || INPUT_ERRORS.has(r.error.code));
      }),
    );
  });

  it('availableEvents(s, ctx) ⊆ availableEvents(s) và đúng thứ tự khai báo', () => {
    fc.assert(
      fc.property(stateArb, ctxArb, (s, ctx) => {
        const structural = availableEvents(s);
        const withCtx = availableEvents(s, ctx);
        expect(withCtx.every((e) => structural.includes(e))).toBe(true);
        expect(withCtx).toEqual(structural.filter((e) => withCtx.includes(e)));
      }),
    );
  });

  it('transition thành công luôn trả về trạng thái đúng bảng; thất bại luôn là DomainError có mã', () => {
    fc.assert(
      fc.property(stateArb, eventArb, fc.option(ctxArb, { nil: undefined }), (s, e, ctx) => {
        const r = transition(s, e, ctx);
        if (r.ok) {
          expect(r.value).toBe(EXPECTED[s][e]);
        } else {
          expect(r.error).toBeInstanceOf(DomainError);
          expect(typeof r.error.code).toBe('string');
        }
      }),
    );
  });

  it('trạng thái kết thúc không có lối ra dù ctx thế nào', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<RfqStatus>('DELIVERED', 'CANCELLED', 'EXPIRED'),
        eventArb,
        ctxArb,
        (s, e, ctx) => {
          expect(transition(s, e, ctx).ok).toBe(false);
          expect(availableEvents(s, ctx)).toEqual([]);
        },
      ),
    );
  });

  it('mọi đường đi từ DRAFT (chọn ngẫu nhiên sự kiện hợp lệ) kết thúc ở trạng thái kết thúc sau ≤ 5 bước', () => {
    // Đồ thị không chu trình; đường dài nhất: DRAFT→SENT→BIDDING→ACCEPTED→IN_PRODUCTION→DELIVERED.
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 5, maxLength: 5 }), (picks) => {
        let state: RfqStatus = 'DRAFT';
        for (const pick of picks) {
          const events = availableEvents(state);
          if (events.length === 0) break;
          const event = events[pick % events.length] as RfqEvent;
          const r = transition(state, event);
          expect(r.ok).toBe(true);
          if (r.ok) state = r.value;
        }
        expect(isRfqTerminal(state)).toBe(true);
      }),
    );
  });
});
