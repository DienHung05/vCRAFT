import type { AllocationStatus } from '../allocation/allocation-state-machine';
import type { BidStatus } from './bid-state-machine';

/** Trạng thái RFQ (SRS §4.1). */
export const RFQ_STATUSES = [
  'DRAFT',
  'SENT',
  'BIDDING',
  'ACCEPTED',
  'IN_PRODUCTION',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

/** Sự kiện RFQ (SRS §4.1). */
export const RFQ_EVENTS = [
  'SUBMIT',
  'RECEIVE_BID',
  'ACCEPT_BID',
  'START_PRODUCTION',
  'CONFIRM_DELIVERY',
  'CANCEL',
  'ADMIN_CANCEL',
  'EXPIRE',
] as const;
export type RfqEvent = (typeof RFQ_EVENTS)[number];

/**
 * Vai trò của tác nhân *tương đối với RFQ đang xét* (SRS §4.1 cột "Tác nhân"):
 * `BUYER_OWNER` = Buyer chủ RFQ; `ARTISAN` = hộ được mời / có phân bổ; `ADMIN` = Admin/BQL; `SYSTEM` = job nền.
 * Quan hệ sở hữu do tầng gọi xác định (policy); domain chỉ kiểm vai trò tương đối.
 */
export const RFQ_ACTOR_ROLES = ['BUYER_OWNER', 'ARTISAN', 'ADMIN', 'SYSTEM'] as const;
export type RfqActorRole = (typeof RFQ_ACTOR_ROLES)[number];

/** T8 / FR-RFQ-10: thời gian Buyer được chốt sau hạn chào giá trước khi RFQ có bid hết hạn. */
export const RFQ_ACCEPT_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Mã lỗi guard của RFQ (cộng thêm `INVALID_TRANSITION` do helper máy trạng thái). */
export type RfqGuardCode =
  | 'MISSING_CONTEXT'
  | 'ACTOR_NOT_ALLOWED'
  | 'EMAIL_NOT_VERIFIED'
  | 'BIDDING_DEADLINE_TOO_SOON'
  | 'DELIVERY_BEFORE_BIDDING_DEADLINE'
  | 'BIDDING_CLOSED'
  | 'DUPLICATE_BID'
  | 'BID_NOT_SUBMITTED'
  | 'BID_QUANTITY_MISMATCH'
  | 'ACCEPT_WINDOW_CLOSED'
  | 'PRODUCTION_START_NOT_PERMITTED'
  | 'ALLOCATIONS_NOT_CONFIRMED'
  | 'ALLOCATIONS_NOT_DONE'
  | 'REASON_REQUIRED'
  | 'NOT_YET_EXPIRED';

/**
 * Ngữ cảnh đánh giá guard. `transition`/`availableEvents` luôn nhận một `RfqContext` (có thể rỗng);
 * các trường bên trong tùy chọn; guard cần trường nào mà thiếu ⇒ `MISSING_CONTEXT`.
 * Dữ liệu RFQ "hợp lệ" (T1) do Zod trong `packages/contracts` kiểm, không lặp ở domain.
 */
export interface RfqContext {
  readonly actor?: RfqActorRole | undefined;
  readonly now?: Date | undefined;
  readonly emailVerified?: boolean | undefined;
  readonly biddingClosesAt?: Date | undefined;
  readonly requiredBy?: Date | undefined;
  /** Số lượng cần của RFQ. */
  readonly quantity?: number | undefined;
  /** RECEIVE_BID: hộ gửi bid đã có bid cho RFQ này chưa (BR-L3). */
  readonly hasBidFromArtisan?: boolean | undefined;
  /** ACCEPT_BID: chào giá được chọn. */
  readonly bid?: { readonly status: BidStatus; readonly quantityOffered: number } | undefined;
  /** START_PRODUCTION / CONFIRM_DELIVERY: trạng thái các Phân bổ đang hiệu lực. */
  readonly allocationStatuses?: readonly AllocationStatus[] | undefined;
  /** START_PRODUCTION (T4): số hộ có Phân bổ đang hiệu lực trong đơn. Do tầng ứng dụng đếm từ dữ liệu. */
  readonly householdCount?: number | undefined;
  /**
   * START_PRODUCTION (T4): tác nhân là chủ của Phân bổ duy nhất của đơn (tầng ứng dụng suy ra từ danh tính
   * hộ/nghệ nhân đang đăng nhập). Chỉ có nghĩa khi `householdCount = 1`.
   */
  readonly actorOwnsSoleAllocation?: boolean | undefined;
  /** CANCEL / ADMIN_CANCEL: lý do bắt buộc. */
  readonly reason?: string | undefined;
}
