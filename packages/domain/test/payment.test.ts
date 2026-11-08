import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  amountsMatch,
  availablePaymentEvents,
  balanceAmountVnd,
  buildVietQrPayload,
  crc16Ccitt,
  DEFAULT_DEPOSIT_PERCENT,
  depositAmountVnd,
  extractReferenceCode,
  isPaymentFinal,
  isReferenceCode,
  newReferenceCode,
  PAYMENT_EVENTS,
  PAYMENT_STATUSES,
  type PaymentEvent,
  type PaymentStatus,
  paymentAmountVnd,
  paymentEligibility,
  paymentStructuralEvents,
  paymentStructuralNext,
  paymentTransition,
  providerOf,
  transition,
} from '../src';

describe('deposit and balance amounts (ADR-0021)', () => {
  it('takes 30 % of the order total by default', () => {
    expect(DEFAULT_DEPOSIT_PERCENT).toBe(30);
    expect(depositAmountVnd(10_000_000)).toBe(3_000_000);
    expect(depositAmountVnd(1_234_500)).toBe(370_350);
  });

  it('rounds half up to a whole VND', () => {
    // 30 % of 1 235 = 370.5 -> 371; of 1 234 = 370.2 -> 370; of 1 236 = 370.8 -> 371.
    expect(depositAmountVnd(1_235)).toBe(371);
    expect(depositAmountVnd(1_234)).toBe(370);
    expect(depositAmountVnd(1_236)).toBe(371);
    expect(depositAmountVnd(1, 30)).toBe(1);
  });

  it('honours a configured share and rejects shares outside 1..99', () => {
    expect(depositAmountVnd(2_000_000, 50)).toBe(1_000_000);
    for (const bad of [0, 100, -5, 30.5, Number.NaN]) {
      expect(() => depositAmountVnd(1_000_000, bad)).toThrow(/percent/);
    }
  });

  it('rejects a total that is not a positive whole VND', () => {
    for (const bad of [0, -1, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(() => depositAmountVnd(bad)).toThrow(/total/);
    }
  });

  it('property: deposit + balance equals the total, and both stay positive', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1_000_000_000_000 }),
        fc.integer({ min: 1, max: 99 }),
        (total, percent) => {
          const deposit = depositAmountVnd(total, percent);
          expect(Number.isInteger(deposit)).toBe(true);
          expect(deposit).toBeGreaterThanOrEqual(1);
          expect(deposit).toBeLessThanOrEqual(total);
          expect(deposit + balanceAmountVnd(total, deposit)).toBe(total);
          // Within half a VND of the exact share (totals stay far below the float-precision limit).
          expect(Math.abs(deposit - (total / 100) * percent)).toBeLessThanOrEqual(0.5000001);
        },
      ),
    );
  });

  it('keeps deposit plus balance exact for the largest safe totals', () => {
    for (const total of [
      Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER - 1,
      9_007_199_254_740_000,
    ]) {
      const deposit = depositAmountVnd(total);
      expect(Number.isSafeInteger(deposit)).toBe(true);
      expect(deposit + balanceAmountVnd(total, deposit)).toBe(total);
    }
  });

  it('prices a balance from the deposit that was actually paid', () => {
    expect(paymentAmountVnd('DEPOSIT', 10_000_000)).toBe(3_000_000);
    expect(paymentAmountVnd('BALANCE', 10_000_000)).toBe(7_000_000);
    expect(paymentAmountVnd('BALANCE', 10_000_000, 30, 2_500_000)).toBe(7_500_000);
  });

  it('matches amounts exactly', () => {
    expect(amountsMatch(3_000_000, 3_000_000)).toBe(true);
    expect(amountsMatch(3_000_000, 2_999_999)).toBe(false);
    expect(amountsMatch(3_000_000, 3_000_001)).toBe(false);
    expect(amountsMatch(3_000_000, 3_000_000.5)).toBe(false);
  });
});

describe('who may pay what and when', () => {
  const base = {
    kind: 'DEPOSIT',
    requestStatus: 'ACCEPTED',
    depositPaid: false,
    balancePaid: false,
    depositRequired: true,
  } as const;

  it('takes the deposit only while the order waits for production', () => {
    expect(paymentEligibility(base)).toBeUndefined();
    for (const requestStatus of [
      'DRAFT',
      'SENT',
      'BIDDING',
      'IN_PRODUCTION',
      'DELIVERED',
      'CANCELLED',
      'EXPIRED',
    ] as const) {
      expect(paymentEligibility({ ...base, requestStatus })?.code).toBe(
        'PAYMENT_ORDER_NOT_PAYABLE',
      );
    }
    expect(paymentEligibility({ ...base, depositPaid: true })?.code).toBe('PAYMENT_ALREADY_PAID');
  });

  it('takes the balance after the deposit, until delivery is confirmed', () => {
    const balance = { ...base, kind: 'BALANCE', depositPaid: true } as const;
    for (const requestStatus of ['ACCEPTED', 'IN_PRODUCTION', 'DELIVERED'] as const) {
      expect(paymentEligibility({ ...balance, requestStatus })).toBeUndefined();
    }
    expect(paymentEligibility({ ...balance, requestStatus: 'CANCELLED' })?.code).toBe(
      'PAYMENT_ORDER_NOT_PAYABLE',
    );
    expect(paymentEligibility({ ...balance, balancePaid: true })?.code).toBe(
      'PAYMENT_ALREADY_PAID',
    );
    expect(paymentEligibility({ ...balance, depositPaid: false })?.code).toBe(
      'PAYMENT_DEPOSIT_REQUIRED',
    );
    expect(
      paymentEligibility({ ...balance, depositPaid: false, depositRequired: false }),
    ).toBeUndefined();
  });
});

const strongRandom = (length: number) =>
  Uint8Array.from({ length }, () => Math.floor(Math.random() * 256));

describe('payment reference codes', () => {
  it('generates upper-case codes from the safe alphabet', () => {
    for (let index = 0; index < 200; index++) {
      const code = newReferenceCode(strongRandom);
      expect(isReferenceCode(code)).toBe(true);
      expect(code).toMatch(/^VCP[2-9A-HJKMNP-Z]{10}$/);
    }
  });

  it('is deterministic for a fixed random source and never repeats across draws', () => {
    const fixed = newReferenceCode((length) => Uint8Array.from({ length }, (_, index) => index));
    expect(fixed).toBe(
      newReferenceCode((length) => Uint8Array.from({ length }, (_, index) => index)),
    );
    const seen = new Set(Array.from({ length: 500 }, () => newReferenceCode(strongRandom)));
    expect(seen.size).toBe(500);
  });

  it('finds the code inside bank transfer content however the bank wrote it', () => {
    const code = 'VCPAB3DEF7K9M';
    expect(extractReferenceCode(`MB 0123 chuyen tien ${code} cam on`)).toBe(code);
    expect(extractReferenceCode(`thanh toan ${code.toLowerCase()}`)).toBe(code);
    expect(extractReferenceCode('VCP AB3DE-F7K9.M')).toBe(code);
    expect(extractReferenceCode('no code here')).toBeNull();
    expect(extractReferenceCode('VCPAB3DEF7K')).toBeNull();
    expect(extractReferenceCode(null)).toBeNull();
    expect(extractReferenceCode('')).toBeNull();
  });

  it('maps methods to providers', () => {
    expect(providerOf('SEPAY_TRANSFER')).toBe('SEPAY');
    expect(providerOf('VNPAY')).toBe('VNPAY');
    expect(providerOf('MOMO')).toBe('MOMO');
    expect(providerOf('OFFLINE')).toBeNull();
  });
});

describe('VietQR payload', () => {
  it('checksums like CRC-16/CCITT-FALSE', () => {
    expect(crc16Ccitt('123456789')).toBe('29B1');
  });

  it('builds a dynamic NAPAS payload that closes with its own checksum', () => {
    const payload = buildVietQrPayload({
      bankBin: '970422',
      accountNumber: '0123456789',
      amountVnd: 3_000_000,
      content: 'VCPAB3DEF7K9M',
    });
    expect(payload.startsWith('000201010212')).toBe(true);
    expect(payload).toContain('A000000727');
    expect(payload).toContain('0006970422');
    expect(payload).toContain('01100123456789');
    expect(payload).toContain('QRIBFTTA');
    expect(payload).toContain('54073000000');
    expect(payload).toContain('5802VN');
    expect(payload).toContain('0813VCPAB3DEF7K9M');
    const body = payload.slice(0, -4);
    expect(body.endsWith('6304')).toBe(true);
    expect(payload.slice(-4)).toBe(crc16Ccitt(body));
  });
});

/** Table of the payment state machine (ADR-0021). */
const EXPECTED: Record<PaymentStatus, Partial<Record<PaymentEvent, PaymentStatus>>> = {
  PENDING: { CONFIRM: 'PAID', FAIL: 'FAILED', EXPIRE: 'EXPIRED', CANCEL: 'CANCELLED' },
  EXPIRED: { CONFIRM: 'PAID' },
  PAID: { REFUND: 'REFUNDED' },
  FAILED: {},
  CANCELLED: {},
  REFUNDED: {},
};

describe('payment state machine', () => {
  describe.each(PAYMENT_STATUSES)('from %s', (state) => {
    it.each(PAYMENT_EVENTS)('event %s follows the table', (event) => {
      const expected = EXPECTED[state][event];
      const result = paymentStructuralNext(state, event);
      if (expected === undefined) {
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('INVALID_TRANSITION');
      } else {
        expect(result).toEqual({ ok: true, value: expected });
      }
    });
  });

  it('confirms only an exact amount, from a verified provider or an administrator', () => {
    const exact = { expectedAmountVnd: 3_000_000, receivedAmountVnd: 3_000_000 };
    expect(paymentTransition('PENDING', 'CONFIRM', { actor: 'SYSTEM', ...exact })).toEqual({
      ok: true,
      value: 'PAID',
    });
    expect(paymentTransition('PENDING', 'CONFIRM', { actor: 'ADMIN', ...exact }).ok).toBe(true);
    for (const received of [2_999_999, 3_000_001, 0]) {
      const result = paymentTransition('PENDING', 'CONFIRM', {
        actor: 'SYSTEM',
        expectedAmountVnd: 3_000_000,
        receivedAmountVnd: received,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');
    }
    const buyer = paymentTransition('PENDING', 'CONFIRM', { actor: 'BUYER_OWNER', ...exact });
    expect(buyer.ok).toBe(false);
    if (!buyer.ok) expect(buyer.error.code).toBe('ACTOR_NOT_ALLOWED');
    const bare = paymentTransition('PENDING', 'CONFIRM', {});
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.error.code).toBe('MISSING_CONTEXT');
  });

  it('counts a late transfer into an expired payment, but only from the system', () => {
    const late = { expectedAmountVnd: 5, receivedAmountVnd: 5 };
    expect(paymentTransition('EXPIRED', 'CONFIRM', { actor: 'SYSTEM', ...late }).ok).toBe(true);
    expect(paymentTransition('EXPIRED', 'CONFIRM', { actor: 'ADMIN', ...late }).ok).toBe(false);
  });

  it('expires only once the expiry time has passed', () => {
    const expiresAt = new Date('2026-11-09T10:00:00Z');
    const before = paymentTransition('PENDING', 'EXPIRE', {
      actor: 'SYSTEM',
      now: new Date('2026-11-09T09:59:59Z'),
      expiresAt,
    });
    expect(before.ok).toBe(false);
    if (!before.ok) expect(before.error.code).toBe('NOT_YET_EXPIRED');
    expect(
      paymentTransition('PENDING', 'EXPIRE', { actor: 'SYSTEM', now: expiresAt, expiresAt }),
    ).toEqual({ ok: true, value: 'EXPIRED' });
  });

  it('lets the buyer or an administrator cancel a pending payment, not the system', () => {
    expect(paymentTransition('PENDING', 'CANCEL', { actor: 'BUYER_OWNER' }).ok).toBe(true);
    expect(paymentTransition('PENDING', 'CANCEL', { actor: 'ADMIN' }).ok).toBe(true);
    expect(paymentTransition('PENDING', 'CANCEL', { actor: 'SYSTEM' }).ok).toBe(false);
  });

  it('refunds a paid payment only by an administrator, with a reason', () => {
    expect(
      paymentTransition('PAID', 'REFUND', { actor: 'ADMIN', reason: 'Order cancelled' }),
    ).toEqual({
      ok: true,
      value: 'REFUNDED',
    });
    const blank = paymentTransition('PAID', 'REFUND', { actor: 'ADMIN', reason: '  ' });
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.error.code).toBe('REASON_REQUIRED');
    expect(paymentTransition('PAID', 'REFUND', { actor: 'BUYER_OWNER', reason: 'x' }).ok).toBe(
      false,
    );
    expect(paymentTransition('PAID', 'REFUND', { actor: 'SYSTEM', reason: 'x' }).ok).toBe(false);
  });

  it('lists the events a state allows for an actor', () => {
    expect(availablePaymentEvents('PENDING', { actor: 'BUYER_OWNER' })).toEqual(['CANCEL']);
    expect(availablePaymentEvents('PAID', { actor: 'ADMIN' })).toEqual(['REFUND']);
    expect(availablePaymentEvents('PAID', { actor: 'BUYER_OWNER' })).toEqual([]);
    expect(paymentStructuralEvents('PENDING')).toEqual(['CONFIRM', 'FAIL', 'EXPIRE', 'CANCEL']);
    expect(isPaymentFinal('REFUNDED')).toBe(true);
    expect(isPaymentFinal('PAID')).toBe(false);
  });
});

describe('production waits for the deposit (RFQ T4, ADR-0021)', () => {
  const ready = {
    actor: 'ADMIN',
    allocationStatuses: ['CONFIRMED'],
    householdCount: 1,
  } as const;

  it('is not gated when the deployment keeps payment offline', () => {
    expect(transition('ACCEPTED', 'START_PRODUCTION', ready)).toEqual({
      ok: true,
      value: 'IN_PRODUCTION',
    });
    expect(
      transition('ACCEPTED', 'START_PRODUCTION', { ...ready, depositRequired: false }).ok,
    ).toBe(true);
  });

  it('refuses to start production until the deposit is paid when it is required', () => {
    const unpaid = transition('ACCEPTED', 'START_PRODUCTION', {
      ...ready,
      depositRequired: true,
      depositPaid: false,
    });
    expect(unpaid.ok).toBe(false);
    if (!unpaid.ok) expect(unpaid.error.code).toBe('PAYMENT_DEPOSIT_REQUIRED');
    expect(transition('ACCEPTED', 'START_PRODUCTION', { ...ready, depositRequired: true }).ok).toBe(
      false,
    );
    expect(
      transition('ACCEPTED', 'START_PRODUCTION', {
        ...ready,
        depositRequired: true,
        depositPaid: true,
      }),
    ).toEqual({ ok: true, value: 'IN_PRODUCTION' });
  });
});
