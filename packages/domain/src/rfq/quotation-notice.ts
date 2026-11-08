/**
 * Thông báo trong luồng báo giá (GH#13, FR-NOTI-01/02): mỗi sự kiện ghi một dòng in-app cho từng
 * người nhận và một thư SMTP. Không có SMS, push hay thư tổng hợp.
 *
 * | Loại                    | Người nhận                                          |
 * | ----------------------- | --------------------------------------------------- |
 * | `RFQ_INVITED`           | Đại diện hộ vừa được mời                            |
 * | `CONTRIBUTION_RECEIVED` | Admin điều phối (hộ vừa gửi/sửa đề xuất tham gia)   |
 * | `QUOTATION_RECEIVED`    | Người mua (chào giá mới tới)                        |
 * | `QUOTATION_WITHDRAWN`   | Người mua, admin điều phối (chào giá mất hiệu lực)  |
 * | `QUOTATION_ACCEPTED`    | Admin điều phối                                     |
 * | `ALLOCATION_PROPOSED`   | Đại diện hộ có phần trong đơn                       |
 * | `ALLOCATION_CONFIRMED`  | Người mua, admin điều phối                          |
 * | `ALLOCATION_REASSIGNED` | Đại diện hộ bị chuyển bớt phần việc trễ (GH#247)    |
 * | `ORDER_CANCELLED`       | Mọi bên của đơn                                     |
 * | `PRODUCTION_STARTED`    | Người mua, các hộ có phần                           |
 * | `PROGRESS_REPORTED`     | Người mua, admin điều phối                          |
 * | `ORDER_RECEIVED`        | Các hộ có phần, admin điều phối                     |
 * | `BIDDING_CLOSED`        | Người mua, các hộ được mời (hạn chào giá đã qua)     |
 * | `RFQ_EXPIRED`           | Người mua, các hộ được mời (hết hạn không chốt)      |
 * | `COORDINATION_NEEDED`   | Admin điều phối, hoặc mọi admin khi chưa ai nhận     |
 *
 * Người gây ra sự kiện không tự nhận thông báo của chính mình.
 */
export const QUOTATION_NOTICE_KINDS = [
  'QUOTATION_WITHDRAWN',
  'RFQ_INVITED',
  'CONTRIBUTION_RECEIVED',
  'QUOTATION_RECEIVED',
  'QUOTATION_ACCEPTED',
  'ALLOCATION_PROPOSED',
  'ALLOCATION_CONFIRMED',
  'ALLOCATION_REASSIGNED',
  'ORDER_CANCELLED',
  'PRODUCTION_STARTED',
  'PROGRESS_REPORTED',
  'ORDER_RECEIVED',
  'BIDDING_CLOSED',
  'RFQ_EXPIRED',
  'COORDINATION_NEEDED',
] as const;
export type QuotationNoticeKind = (typeof QUOTATION_NOTICE_KINDS)[number];

/** Danh sách người nhận: bỏ trống, bỏ trùng, bỏ chính người gây ra sự kiện; giữ thứ tự đầu vào. */
export function noticeRecipients(
  candidates: ReadonlyArray<string | null | undefined>,
  actorId: string,
): string[] {
  return [...new Set(candidates.filter((id): id is string => Boolean(id) && id !== actorId))];
}
