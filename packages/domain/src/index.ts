/**
 * @vcraft/domain — lõi nghiệp vụ, KHÔNG phụ thuộc framework/ORM.
 * - rfq/          Máy trạng thái Yêu cầu báo giá + Chào giá (State pattern) + guard nghiệp vụ
 * - exhibition/   Ghi công người làm, tách phòng trưng bày đón khách khỏi xưởng sản xuất
 * - household/    Duyệt hộ (chấp nhận, từ chối, tạm ngừng) và xuất bản / rút sản phẩm
 * - allocation/   Máy trạng thái Phân bổ và kiểm tra bảng chia số lượng thủ công
 * - matching/     Chấm điểm & chọn hộ phù hợp để gửi yêu cầu báo giá
 * - journal/      Nhật ký sản xuất: công đoạn, mốc đính chính, chuỗi băm SHA-256 (append-only)
 * - media/        Luật upload (loại thật theo magic bytes, kích thước, bucket) và mốc biến thể ảnh
 * - news/         Phân loại và trạng thái tin tức làng nghề
 * - notification/ Loại thông báo in-app, người nhận theo vai trò và trang đích
 * - privacy/      Mục đích và phiên bản chính sách của sự đồng ý xử lý dữ liệu cá nhân (NFR-SEC-07)
 * - village/      Ranh giới xã Bát Tràng (GeoJSON tĩnh) và kiểm tra điểm trong đa giác
 * - shared/     DomainError, Result, helper máy trạng thái; (sau này) Money, GeoPoint, OpeningHours
 */
export * from './allocation';
export * from './exhibition';
export * from './household';
export * from './journal';
export * from './media';
export * from './news';
export * from './notification';
export * from './privacy';
export * from './rfq';
export * from './shared';
export * from './village';
