/** Địa chỉ API mà server Next gọi (nội bộ, không nhúng vào trình duyệt). */
export function apiBaseUrl(): string {
  const configured = process.env.API_INTERNAL_URL?.trim();
  return (configured || 'http://localhost:4000/api/v1').replace(/\/+$/, '');
}
