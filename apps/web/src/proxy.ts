import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next 16: proxy.ts thay middleware.ts. Hiện chỉ lo phát hiện locale; redirect /q/:code,
// phiên Supabase và chặn studio/admin thêm vào sau (ARCHITECTURE: proxy.ts).
export default createMiddleware(routing);

export const config = {
  // Bỏ qua API, tài nguyên Next, đường dẫn QR ngắn /q và mọi file có đuôi.
  matcher: '/((?!api|q/|_next|_vercel|.*\\..*).*)',
};
