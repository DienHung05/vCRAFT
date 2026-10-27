/**
 * @vcraft/domain — lõi nghiệp vụ, KHÔNG phụ thuộc framework/ORM.
 * - rfq/          Máy trạng thái Yêu cầu báo giá + Chào giá (State pattern) + guard nghiệp vụ
 * - allocation/   Máy trạng thái Phân bổ; (sau này) chiến lược chia nhỏ đơn hàng (Strategy pattern)
 * - matching/     Chấm điểm & chọn hộ phù hợp để gửi yêu cầu báo giá
 * - traceability/ Chuỗi băm SHA-256 cho nhật ký sản xuất (append-only)
 * - shared/       DomainError, Result, helper máy trạng thái; (sau này) Money, GeoPoint, OpeningHours
 */
export * from './allocation';
export * from './rfq';
export * from './shared';
