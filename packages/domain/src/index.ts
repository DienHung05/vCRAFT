/**
 * @vcraft/domain — lõi nghiệp vụ, KHÔNG phụ thuộc framework/ORM.
 * - rfq/          Máy trạng thái Yêu cầu báo giá + Chào giá (State pattern) + guard nghiệp vụ
 * - household/    Duyệt hộ (chấp nhận, từ chối, tạm ngừng) và xuất bản / rút sản phẩm
 * - allocation/   Máy trạng thái Phân bổ; (sau này) chiến lược chia nhỏ đơn hàng (Strategy pattern)
 * - matching/     Chấm điểm & chọn hộ phù hợp để gửi yêu cầu báo giá
 * - journal/      Nhật ký sản xuất: công đoạn, mốc đính chính, chuỗi băm SHA-256 (append-only)
 * - shared/       DomainError, Result, helper máy trạng thái; (sau này) Money, GeoPoint, OpeningHours
 */
export * from './allocation';
export * from './household';
export * from './journal';
export * from './rfq';
export * from './shared';
