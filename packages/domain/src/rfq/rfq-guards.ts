import { DomainError } from '../shared/domain-error';
import type { Guard } from '../shared/state-machine';
import {
  RFQ_ACCEPT_GRACE_MS,
  type RfqActorRole,
  type RfqContext,
  type RfqGuardCode,
} from './rfq-types';

/** Guard nghiệp vụ của RFQ, cài dạng hàm thuần (SRS §4.1 cột "Điều kiện"). */
type RfqGuard = Guard<RfqContext, RfqGuardCode>;

const missing = (...fields: string[]) =>
  new DomainError<RfqGuardCode>('MISSING_CONTEXT', `Missing context: ${fields.join(', ')}`, {
    fields,
  });

/** Tác nhân phải thuộc danh sách cho phép (cột "Tác nhân" của SRS §4.1). */
export const actorIn =
  (...allowed: readonly RfqActorRole[]): RfqGuard =>
  (ctx) => {
    if (ctx.actor === undefined) return missing('actor');
    if (!allowed.includes(ctx.actor)) {
      return new DomainError('ACTOR_NOT_ALLOWED', `Actor ${ctx.actor} cannot perform this event`, {
        actor: ctx.actor,
        allowed,
      });
    }
    return undefined;
  };

/** T1: email đã xác minh. */
export const emailVerified: RfqGuard = (ctx) => {
  if (ctx.emailVerified === undefined) return missing('emailVerified');
  return ctx.emailVerified
    ? undefined
    : new DomainError('EMAIL_NOT_VERIFIED', 'Email must be verified before submitting an RFQ');
};

/** T1 (83g): `biddingClosesAt > now` — any future time, no 24h minimum. */
export const biddingDeadlineInFuture: RfqGuard = (ctx) => {
  if (ctx.now === undefined || ctx.biddingClosesAt === undefined) {
    return missing('now', 'biddingClosesAt');
  }
  return ctx.biddingClosesAt.getTime() > ctx.now.getTime()
    ? undefined
    : new DomainError(
        'BIDDING_DEADLINE_TOO_SOON',
        'biddingClosesAt must be in the future',
        {
          rule: 'T1',
        },
      );
};

/** T1: `requiredBy > biddingClosesAt`. */
export const deliveryAfterBiddingDeadline: RfqGuard = (ctx) => {
  if (ctx.requiredBy === undefined || ctx.biddingClosesAt === undefined) {
    return missing('requiredBy', 'biddingClosesAt');
  }
  return ctx.requiredBy.getTime() > ctx.biddingClosesAt.getTime()
    ? undefined
    : new DomainError(
        'DELIVERY_BEFORE_BIDDING_DEADLINE',
        'requiredBy must be after biddingClosesAt',
        { rule: 'T1' },
      );
};

/** T2: `now < biddingClosesAt`. */
export const biddingStillOpen: RfqGuard = (ctx) => {
  if (ctx.now === undefined || ctx.biddingClosesAt === undefined) {
    return missing('now', 'biddingClosesAt');
  }
  return ctx.now.getTime() < ctx.biddingClosesAt.getTime()
    ? undefined
    : new DomainError('BIDDING_CLOSED', 'Bidding deadline has passed', { rule: 'T2' });
};

/** T2 / BR-L3: mỗi hộ tối đa một bid cho mỗi RFQ. */
export const noExistingBidFromArtisan: RfqGuard = (ctx) => {
  if (ctx.hasBidFromArtisan === undefined) return missing('hasBidFromArtisan');
  return ctx.hasBidFromArtisan
    ? new DomainError('DUPLICATE_BID', 'Artisan already has a bid for this RFQ', { rule: 'BR-L3' })
    : undefined;
};

/**
 * Hạn chốt cứng (SRS T3/T8, FR-RFQ-10): đã qua `biddingClosesAt + 7 ngày` hay chưa.
 * DÙNG CHUNG cho EXPIRE (T8) và ACCEPT_BID (T3) để hai guard không bao giờ lệch biên:
 * đúng mốc này, ACCEPT bị từ chối còn EXPIRE được phép.
 */
export function hasAcceptWindowElapsed(now: Date, biddingClosesAt: Date): boolean {
  return now.getTime() >= biddingClosesAt.getTime() + RFQ_ACCEPT_GRACE_MS;
}

/**
 * T3 / FR-RFQ-10: chỉ chốt khi `now < biddingClosesAt + 7 ngày`. Hạn là cứng, không phụ thuộc việc
 * job EXPIRE chạy trễ (RFQ có thể vẫn ở BIDDING khi worker chậm).
 */
export const acceptWindowOpen: RfqGuard = (ctx) => {
  if (ctx.now === undefined || ctx.biddingClosesAt === undefined) {
    return missing('now', 'biddingClosesAt');
  }
  return hasAcceptWindowElapsed(ctx.now, ctx.biddingClosesAt)
    ? new DomainError('ACCEPT_WINDOW_CLOSED', 'Buyer accept window (7 days) has elapsed', {
        rule: 'T3',
      })
    : undefined;
};

/**
 * T4: Admin điều phối luôn được bắt đầu sản xuất; Hộ/nghệ nhân chỉ khi đơn có đúng 1 hộ VÀ họ sở hữu
 * Phân bổ duy nhất đó. Tác nhân khác đã bị `actorIn` chặn trước.
 */
export const productionStarterPermitted: RfqGuard = (ctx) => {
  if (ctx.actor === 'ADMIN') return undefined;
  if (ctx.householdCount === undefined || ctx.actorOwnsSoleAllocation === undefined) {
    return missing('householdCount', 'actorOwnsSoleAllocation');
  }
  if (ctx.householdCount !== 1 || !ctx.actorOwnsSoleAllocation) {
    return new DomainError(
      'PRODUCTION_START_NOT_PERMITTED',
      'Only Admin, or the sole household of a single-household order, can start production',
      {
        rule: 'T4',
        householdCount: ctx.householdCount,
        actorOwnsSoleAllocation: ctx.actorOwnsSoleAllocation,
      },
    );
  }
  return undefined;
};

/** T3: bid được chọn phải `SUBMITTED` và `quantityOffered = quantity` (FR-RFQ-08). */
export const bidIsAcceptable: RfqGuard = (ctx) => {
  if (ctx.bid === undefined || ctx.quantity === undefined) return missing('bid', 'quantity');
  if (ctx.bid.status !== 'SUBMITTED') {
    return new DomainError('BID_NOT_SUBMITTED', 'Only a SUBMITTED bid can be accepted', {
      rule: 'T3',
      bidStatus: ctx.bid.status,
    });
  }
  if (ctx.bid.quantityOffered !== ctx.quantity) {
    return new DomainError('BID_QUANTITY_MISMATCH', 'Bid must offer the full RFQ quantity', {
      rule: 'T3',
      quantityOffered: ctx.bid.quantityOffered,
      quantity: ctx.quantity,
    });
  }
  return undefined;
};

/** T4: có ít nhất một Phân bổ và mọi Phân bổ `CONFIRMED`. */
export const allAllocationsConfirmed: RfqGuard = (ctx) => {
  if (ctx.allocationStatuses === undefined) return missing('allocationStatuses');
  const all = ctx.allocationStatuses;
  return all.length > 0 && all.every((s) => s === 'CONFIRMED')
    ? undefined
    : new DomainError('ALLOCATIONS_NOT_CONFIRMED', 'Every allocation must be CONFIRMED', {
        rule: 'T4',
      });
};

/** T5: có ít nhất một Phân bổ và mọi Phân bổ `DONE`. */
export const allAllocationsDone: RfqGuard = (ctx) => {
  if (ctx.allocationStatuses === undefined) return missing('allocationStatuses');
  const all = ctx.allocationStatuses;
  return all.length > 0 && all.every((s) => s === 'DONE')
    ? undefined
    : new DomainError('ALLOCATIONS_NOT_DONE', 'Every allocation must be DONE', { rule: 'T5' });
};

/** T6 / T7: lý do hủy không rỗng. */
export const reasonProvided: RfqGuard = (ctx) => {
  if (ctx.reason === undefined) return missing('reason');
  return ctx.reason.trim().length > 0
    ? undefined
    : new DomainError('REASON_REQUIRED', 'A cancellation reason is required', { rule: 'T6/T7' });
};

/** T8 (SENT): `now ≥ biddingClosesAt`. */
export const biddingDeadlinePassed: RfqGuard = (ctx) => {
  if (ctx.now === undefined || ctx.biddingClosesAt === undefined) {
    return missing('now', 'biddingClosesAt');
  }
  return ctx.now.getTime() >= ctx.biddingClosesAt.getTime()
    ? undefined
    : new DomainError('NOT_YET_EXPIRED', 'Bidding deadline has not passed yet', { rule: 'T8' });
};

/** T8 (BIDDING): `now ≥ biddingClosesAt + 7 ngày` và chưa chốt (trạng thái BIDDING đã bảo đảm). */
export const acceptGracePeriodPassed: RfqGuard = (ctx) => {
  if (ctx.now === undefined || ctx.biddingClosesAt === undefined) {
    return missing('now', 'biddingClosesAt');
  }
  return hasAcceptWindowElapsed(ctx.now, ctx.biddingClosesAt)
    ? undefined
    : new DomainError('NOT_YET_EXPIRED', 'Buyer accept window (7 days) has not elapsed', {
        rule: 'T8',
      });
};
