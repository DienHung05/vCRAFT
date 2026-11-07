import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { readRememberPreference, withRememberPolicy } from './remember';
import { supabaseConfig } from './supabase-config';

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse['cookies']['set']>[2];
};

export interface RefreshedSession {
  /** Ghi cookie phiên mới (và header chống cache) vào phản hồi sắp trả cho trình duyệt. */
  apply(response: NextResponse): NextResponse;
}

/**
 * Làm mới phiên Supabase "im lặng" trước khi trang render (FR-AUTH-04): access token sắp hết hạn thì
 * đổi bằng refresh token, rồi ghi lại cả vào cookie của request (để Server Component phía sau đọc
 * token mới) lẫn phản hồi (để trình duyệt giữ token mới). Request không có cookie phiên thì không
 * gọi gì. `getClaims()` kiểm chữ ký bằng JWKS tại chỗ nên không tốn một vòng tới Supabase.
 */
export async function refreshSession(request: NextRequest): Promise<RefreshedSession> {
  const pending: CookieToSet[] = [];
  let noCache: Record<string, string> = {};
  const config = supabaseConfig();
  const hasSession = request.cookies.getAll().some((cookie) => cookie.name.startsWith('sb-'));

  if (config && hasSession) {
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list, headers) => {
          // Not remembered: the auth cookies become session cookies (see ./remember).
          const remember = readRememberPreference(request.cookies.getAll());
          for (const cookie of list) {
            request.cookies.set(cookie.name, cookie.value);
            pending.push({ ...cookie, options: withRememberPolicy(cookie.options, remember) });
          }
          noCache = headers ?? {};
        },
      },
    });
    try {
      await supabase.auth.getClaims();
    } catch {
      // Supabase không phản hồi: để trang tự xử lý như khách, không chặn request.
    }
  }

  return {
    apply(response) {
      for (const { name, value, options } of pending)
        response.cookies.set({ name, value, ...options });
      for (const [key, value] of Object.entries(noCache)) response.headers.set(key, value);
      return response;
    },
  };
}
