/**
 * Origin công khai của site, dùng để sinh URL tuyệt đối trong mã QR (FR-TRC-02).
 *
 * Lấy từ `NEXT_PUBLIC_SITE_URL` (được Next nhúng lúc build). Khi chưa cấu hình: dev dùng
 * `http://localhost:3000`; bản production dùng tên miền chính thức làm phương án cuối, nên deploy
 * thật phải đặt biến này (xem `.env.example`).
 */
const DEV_ORIGIN = 'http://localhost:3000';
const PRODUCTION_FALLBACK_ORIGIN = 'https://vcraft.vn';

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return process.env.NODE_ENV === 'production' ? PRODUCTION_FALLBACK_ORIGIN : DEV_ORIGIN;
}

/** URL ngắn mã hóa trong QR: `<origin>/q/<code>`. */
export function traceShortUrl(code: string): string {
  return `${siteOrigin()}/q/${encodeURIComponent(code)}`;
}

/**
 * Mã truy xuất hợp lệ về định dạng: 8 ký tự thuộc bảng `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (SRS BR-04;
 * chuỗi này có 32 ký tự và gồm cả `L`, trong khi SRS ghi "31 ký tự, bỏ L". Theo chuỗi, vì mã mẫu có `L`).
 */
export const TRACE_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

export function isTraceCode(code: string): boolean {
  return TRACE_CODE_PATTERN.test(code.toUpperCase());
}
