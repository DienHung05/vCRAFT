import type { AccountRole, HouseholdEvent } from '../household/household-state-machine';
import { QUOTATION_NOTICE_KINDS, type QuotationNoticeKind } from '../rfq/quotation-notice';

/**
 * Thông báo in-app của mọi vai trò (GH#37, FR-NOTI-01…03): gồm các loại trong luồng báo giá (xem
 * `quotation-notice.ts`), các quyết định của Ban quản lý về hồ sơ hộ, và tin quan trọng vừa đăng
 * (`NEWS_PUBLISHED`, gửi tới đại diện các hộ đã được chấp nhận).
 *
 * | Loại                   | Người nhận                           |
 * | ---------------------- | ------------------------------------ |
 * | `HOUSEHOLD_APPROVED`   | Đại diện hộ vừa được chấp nhận       |
 * | `HOUSEHOLD_REJECTED`   | Đại diện hộ bị từ chối               |
 * | `HOUSEHOLD_INFO_REQUESTED` | Đại diện hộ cần bổ sung hồ sơ     |
 * | `HOUSEHOLD_SUSPENDED`  | Đại diện hộ bị tạm ngừng trưng bày   |
 * | `HOUSEHOLD_REINSTATED` | Đại diện hộ được khôi phục trưng bày |
 */
export const HOUSEHOLD_NOTICE_KINDS = [
  'HOUSEHOLD_APPROVED',
  'HOUSEHOLD_REJECTED',
  'HOUSEHOLD_INFO_REQUESTED',
  'HOUSEHOLD_SUSPENDED',
  'HOUSEHOLD_REINSTATED',
] as const;
export type HouseholdNoticeKind = (typeof HOUSEHOLD_NOTICE_KINDS)[number];

export const NOTIFICATION_TYPES = [
  ...QUOTATION_NOTICE_KINDS,
  ...HOUSEHOLD_NOTICE_KINDS,
  'NEWS_PUBLISHED',
] as const;
export type NotificationType = QuotationNoticeKind | HouseholdNoticeKind | 'NEWS_PUBLISHED';

export function isNotificationType(value: unknown): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly unknown[]).includes(value);
}

const HOUSEHOLD_EVENT_KIND: Record<HouseholdEvent, HouseholdNoticeKind> = {
  APPROVE: 'HOUSEHOLD_APPROVED',
  REJECT: 'HOUSEHOLD_REJECTED',
  REQUEST_INFO: 'HOUSEHOLD_INFO_REQUESTED',
  SUSPEND: 'HOUSEHOLD_SUSPENDED',
  REINSTATE: 'HOUSEHOLD_REINSTATED',
};

/** Loại thông báo cho quyết định của Ban quản lý về một hộ. */
export function householdNoticeKind(event: HouseholdEvent): HouseholdNoticeKind {
  return HOUSEHOLD_EVENT_KIND[event];
}

/**
 * Loại thông báo mỗi vai trò có thể nhận (theo bảng người nhận ở `quotation-notice.ts`). Dùng để
 * chỉ hiện đúng các tùy chọn email trong trang tài khoản.
 */
export const NOTIFICATION_TYPES_BY_ROLE: Record<AccountRole, readonly NotificationType[]> = {
  BUYER: [
    'QUOTATION_RECEIVED',
    'QUOTATION_WITHDRAWN',
    'ALLOCATION_CONFIRMED',
    'ORDER_CANCELLED',
    'PRODUCTION_STARTED',
    'PROGRESS_REPORTED',
  ],
  HOUSEHOLD: [
    'HOUSEHOLD_APPROVED',
    'HOUSEHOLD_REJECTED',
    'HOUSEHOLD_INFO_REQUESTED',
    'HOUSEHOLD_SUSPENDED',
    'HOUSEHOLD_REINSTATED',
    'RFQ_INVITED',
    'ALLOCATION_PROPOSED',
    'ORDER_CANCELLED',
    'PRODUCTION_STARTED',
    'ORDER_RECEIVED',
    'NEWS_PUBLISHED',
  ],
  ADMIN: [
    'CONTRIBUTION_RECEIVED',
    'QUOTATION_WITHDRAWN',
    'QUOTATION_ACCEPTED',
    'ALLOCATION_CONFIRMED',
    'ORDER_CANCELLED',
    'PROGRESS_REPORTED',
    'ORDER_RECEIVED',
  ],
};

/** Trang đích của một thông báo, tách khỏi ngôn ngữ: web và worker tự đổi sang đường dẫn của mình. */
export const NOTIFICATION_TARGET_PAGES = [
  /** Buyer: chi tiết yêu cầu báo giá. */
  'BUYER_RFQ',
  /** Hộ: màn đề xuất tham gia và phân bổ của một yêu cầu trong Studio. */
  'STUDIO_CONTRIBUTION',
  /** Admin: màn điều phối của yêu cầu. */
  'ADMIN_COORDINATION',
  /** Hộ: trạng thái hồ sơ đã nộp (kết quả duyệt). */
  'STUDIO_APPLICATION',
  /** News article, addressed by the news id. */
  'NEWS_ARTICLE',
] as const;
export type NotificationTargetPage = (typeof NOTIFICATION_TARGET_PAGES)[number];

export interface NotificationTarget {
  page: NotificationTargetPage;
  /** Mã yêu cầu báo giá; `null` với trang không cần mã (trạng thái hồ sơ). */
  id: string | null;
}

const REQUEST_PAGE: Record<AccountRole, NotificationTargetPage> = {
  BUYER: 'BUYER_RFQ',
  HOUSEHOLD: 'STUDIO_CONTRIBUTION',
  ADMIN: 'ADMIN_COORDINATION',
};

/**
 * Trang một thông báo dẫn tới, theo loại và vai trò người nhận. `subjectId` là mã yêu cầu báo giá
 * với thông báo luồng báo giá. Thông báo hồ sơ hộ luôn dẫn tới trang trạng thái hồ sơ (kể cả khi hộ
 * bị từ chối hay chưa có khu làm việc). Thiếu mã yêu cầu thì không có đích (`null`).
 */
export function notificationTarget(
  type: NotificationType,
  role: AccountRole,
  subjectId: string | null | undefined,
): NotificationTarget | null {
  if ((HOUSEHOLD_NOTICE_KINDS as readonly string[]).includes(type)) {
    return { page: 'STUDIO_APPLICATION', id: null };
  }
  if (!subjectId) return null;
  if (type === 'NEWS_PUBLISHED') return { page: 'NEWS_ARTICLE', id: subjectId };
  return { page: REQUEST_PAGE[role], id: subjectId };
}
