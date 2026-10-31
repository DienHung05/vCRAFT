import { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { PATH_HEADER } from './lib/auth/path-header';
import { refreshSession } from './lib/auth/proxy-session';

const handleI18nRouting = createMiddleware(routing);

/**
 * Next 16: proxy.ts thay middleware.ts. Mỗi request đi qua ba việc, theo thứ tự:
 * 1. làm mới phiên Supabase nếu access token sắp hết hạn (FR-AUTH-04), để trang render với token mới;
 * 2. đặt header `x-vcraft-path` (đường dẫn công khai) cho guard của layout tạo đích quay lại;
 * 3. phát hiện ngôn ngữ và chuyển hướng theo next-intl.
 * Redirect `/q/:code` do route handler, còn chặn theo vai trò do layout (xem lib/auth/guard.ts).
 */
export default async function proxy(request: NextRequest) {
  const session = await refreshSession(request);
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = handleI18nRouting(new NextRequest(request, { headers }));
  return session.apply(response);
}

export const config = {
  // Bỏ qua API, tài nguyên Next, đường dẫn QR ngắn /q, route xác thực /auth (tự quản cookie) và mọi file có đuôi.
  matcher: '/((?!api|q/|auth/|_next|_vercel|.*\\..*).*)',
};
