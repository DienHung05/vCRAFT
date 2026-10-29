import { createStateMachine, type TransitionTable } from '../shared/state-machine';
import {
  acceptGracePeriodPassed,
  acceptWindowOpen,
  actorIn,
  allAllocationsConfirmed,
  allAllocationsDone,
  biddingDeadlinePassed,
  biddingStillOpen,
  biddingDeadlineInFuture,
  bidIsAcceptable,
  deliveryAfterBiddingDeadline,
  emailVerified,
  noExistingBidFromArtisan,
  productionStarterPermitted,
  reasonProvided,
} from './rfq-guards';
import {
  RFQ_EVENTS,
  RFQ_STATUSES,
  type RfqContext,
  type RfqEvent,
  type RfqGuardCode,
  type RfqStatus,
} from './rfq-types';

/**
 * Bảng chuyển trạng thái RFQ (SRS §4.1) — cài MỘT LẦN, dùng chung backend (cưỡng chế)
 * và frontend (hiển thị nút hợp lệ, FR-RFQ-12). `ref` là mã dòng T1..T8 của SRS.
 * Các tác dụng phụ (ghép hộ, tạo Order, thông báo…) thuộc tầng ứng dụng, không nằm ở đây;
 * khóa bi quan của T3/T4 (BR-L2) là cơ chế giao dịch ở tầng hạ tầng.
 */
export const RFQ_TRANSITIONS = {
  DRAFT: {
    SUBMIT: {
      to: 'SENT',
      ref: 'T1',
      guards: [actorIn('BUYER_OWNER'), emailVerified],
      inputGuards: [biddingDeadlineInFuture, deliveryAfterBiddingDeadline],
    },
    CANCEL: { to: 'CANCELLED', ref: 'T6', guards: [actorIn('BUYER_OWNER')] }, // nháp: không cần lý do
  },
  SENT: {
    RECEIVE_BID: {
      to: 'BIDDING',
      ref: 'T2',
      guards: [actorIn('ARTISAN', 'ADMIN'), biddingStillOpen],
      inputGuards: [noExistingBidFromArtisan],
    },
    CANCEL: {
      to: 'CANCELLED',
      ref: 'T6',
      guards: [actorIn('BUYER_OWNER')],
      inputGuards: [reasonProvided],
    },
    EXPIRE: {
      to: 'EXPIRED',
      ref: 'T8',
      guards: [actorIn('SYSTEM'), biddingDeadlinePassed],
    },
  },
  BIDDING: {
    ACCEPT_BID: {
      to: 'ACCEPTED',
      ref: 'T3',
      guards: [actorIn('BUYER_OWNER'), acceptWindowOpen], // T3: hạn chốt cứng (FR-RFQ-10)
      inputGuards: [bidIsAcceptable],
    },
    CANCEL: {
      to: 'CANCELLED',
      ref: 'T6',
      guards: [actorIn('BUYER_OWNER')],
      inputGuards: [reasonProvided],
    },
    EXPIRE: {
      to: 'EXPIRED',
      ref: 'T8',
      guards: [actorIn('SYSTEM'), acceptGracePeriodPassed],
    },
  },
  ACCEPTED: {
    CANCEL: {
      to: 'CANCELLED',
      ref: 'T6',
      guards: [actorIn('BUYER_OWNER')],
      inputGuards: [reasonProvided],
    },
    START_PRODUCTION: {
      to: 'IN_PRODUCTION',
      ref: 'T4',
      guards: [actorIn('ADMIN', 'ARTISAN'), productionStarterPermitted, allAllocationsConfirmed],
    },
    ADMIN_CANCEL: {
      to: 'CANCELLED',
      ref: 'T7',
      guards: [actorIn('ADMIN')],
      inputGuards: [reasonProvided],
    },
  },
  IN_PRODUCTION: {
    ADMIN_CANCEL: {
      to: 'CANCELLED',
      ref: 'T7',
      guards: [actorIn('ADMIN')],
      inputGuards: [reasonProvided],
    },
    CONFIRM_DELIVERY: {
      to: 'DELIVERED',
      ref: 'T5',
      guards: [actorIn('BUYER_OWNER', 'ADMIN'), allAllocationsDone],
    },
  },
  DELIVERED: {},
  CANCELLED: {},
  EXPIRED: {},
} as const satisfies TransitionTable<RfqStatus, RfqEvent, RfqContext, RfqGuardCode>;

export const rfqStateMachine = createStateMachine<RfqStatus, RfqEvent, RfqContext, RfqGuardCode>({
  name: 'RFQ',
  states: RFQ_STATUSES,
  events: RFQ_EVENTS,
  table: RFQ_TRANSITIONS,
});

/**
 * Trạng thái kế tiếp hoặc lỗi `DomainError` có kiểu (`INVALID_TRANSITION` | mã guard).
 * `ctx` BẮT BUỘC: luôn kiểm tác nhân + guard (thiếu dữ kiện ⇒ `MISSING_CONTEXT`). Không có đường tắt bỏ guard.
 */
export const transition = rfqStateMachine.transition;

/**
 * Sự kiện hợp lệ ở `state`, lọc theo tác nhân và guard khả dụng của `ctx`, KHÔNG xét dữ liệu nhập
 * kèm lệnh (lý do hủy, bid được chọn, hạn chào giá của form) — nút vẫn hiện, `transition` mới báo lỗi nhập.
 */
export const availableEvents = rfqStateMachine.availableEvents;

/** Tra cứu thuần cấu trúc bảng (SRS §4.1), KHÔNG kiểm tác nhân/guard: không dùng để cho phép hành động. */
export const rfqStructuralNext = rfqStateMachine.structuralNext;
export const rfqStructuralEvents = rfqStateMachine.structuralEvents;

export const isRfqTerminal = rfqStateMachine.isTerminal;
