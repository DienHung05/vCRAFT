import { DomainError } from '../shared/domain-error';
import { createStateMachine, type TransitionTable } from '../shared/state-machine';
import type { RfqStatus } from './rfq-types';

/**
 * Máy trạng thái Chào giá (SRS §4.2).
 * `SUBMITTED` --REVISE--> `SUBMITTED` (revision++ do tầng ứng dụng) | ACCEPTED | REJECTED | WITHDRAWN | LAPSED.
 * Bid sinh ra ở `SUBMITTED` khi hộ gửi chào giá.
 */
export const BID_STATUSES = ['SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'LAPSED'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export const BID_EVENTS = ['REVISE', 'ACCEPT', 'REJECT', 'WITHDRAW', 'LAPSE'] as const;
export type BidEvent = (typeof BID_EVENTS)[number];

/** Loại chào giá (SRS §4.2). `COOPERATIVE` kèm `allocationPlan[]`. */
export const BID_TYPES = ['INDIVIDUAL', 'COOPERATIVE'] as const;
export type BidType = (typeof BID_TYPES)[number];

export type BidGuardCode = 'MISSING_CONTEXT' | 'BID_LOCKED';

export interface BidContext {
  readonly rfqStatus?: RfqStatus | undefined;
  readonly biddingClosesAt?: Date | undefined;
  readonly now?: Date | undefined;
}

/**
 * BR-L4 (FR-RFQ-05): bid chỉ sửa được khi RFQ ∈ {SENT, BIDDING} và now < biddingClosesAt.
 * Hàm thuần để API/UI dùng lại ngoài máy trạng thái.
 */
export function canReviseBid(rfqStatus: RfqStatus, biddingClosesAt: Date, now: Date): boolean {
  return (
    (rfqStatus === 'SENT' || rfqStatus === 'BIDDING') && now.getTime() < biddingClosesAt.getTime()
  );
}

function bidIsRevisable(ctx: BidContext): DomainError<BidGuardCode> | undefined {
  if (ctx.rfqStatus === undefined || ctx.biddingClosesAt === undefined || ctx.now === undefined) {
    return new DomainError('MISSING_CONTEXT', 'rfqStatus, biddingClosesAt and now are required');
  }
  if (!canReviseBid(ctx.rfqStatus, ctx.biddingClosesAt, ctx.now)) {
    return new DomainError('BID_LOCKED', 'Bid can no longer be revised', {
      rule: 'BR-L4',
      rfqStatus: ctx.rfqStatus,
    });
  }
  return undefined;
}

export const BID_TRANSITIONS = {
  SUBMITTED: {
    REVISE: { to: 'SUBMITTED', guards: [bidIsRevisable] }, // BR-L4
    ACCEPT: { to: 'ACCEPTED' }, // RFQ T3
    REJECT: { to: 'REJECTED' }, // RFQ T3 (bid không được chọn)
    WITHDRAW: { to: 'WITHDRAWN' }, // FR-RFQ-05
    LAPSE: { to: 'LAPSED' }, // RFQ T6/T8
  },
  ACCEPTED: {},
  REJECTED: {},
  WITHDRAWN: {},
  LAPSED: {},
} as const satisfies TransitionTable<BidStatus, BidEvent, BidContext, BidGuardCode>;

const bidMachine = createStateMachine<BidStatus, BidEvent, BidContext, BidGuardCode>({
  name: 'Bid',
  states: BID_STATUSES,
  events: BID_EVENTS,
  table: BID_TRANSITIONS,
});

export const bidTransition = bidMachine.transition;
export const availableBidEvents = bidMachine.availableEvents;
export const isBidTerminal = bidMachine.isTerminal;
