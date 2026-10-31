import { type Locale, locales } from '@vcraft/i18n';

/**
 * Chuyển hướng 303 với Location TƯƠNG ĐỐI. Đứng sau Caddy, origin trong `request.url` là địa chỉ
 * nội bộ (`localhost:3000`) nên `NextResponse.redirect` sẽ đưa người dùng sang sai cổng.
 * Cookie phiên đặt qua `cookies()` vẫn được gắn vào phản hồi này.
 */
export function redirectTo(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, 'Cache-Control': 'no-store' },
  });
}

/** Ngôn ngữ hợp lệ từ một tham số query, hoặc `null`. */
export function parseLocale(value: string | null | undefined): Locale | null {
  return (locales as readonly string[]).includes(value ?? '') ? (value as Locale) : null;
}
