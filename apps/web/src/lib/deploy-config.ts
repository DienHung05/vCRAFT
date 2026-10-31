/**
 * Cấu hình triển khai của web (ADR-16): web chạy trên Vercel, API chạy trên Render. Thay cho Caddy,
 * Next đảm nhiệm hai việc mà `infra/caddy/routes.caddy` từng làm: chuyển tiếp `/api/*` sang API và đặt
 * header bảo mật. File này chỉ dùng thư viện chuẩn để `next.config.ts` import được.
 */

export interface ApiRewrite {
  source: string;
  destination: string;
}

/**
 * Rewrite `/api/:path*` tới API. Trình duyệt luôn gọi `/api/v1/...` cùng origin với web nên không cần CORS,
 * token Supabase đi trong header `Authorization` (không dùng cookie xuyên origin).
 *
 * Đích suy ra từ `API_INTERNAL_URL` (vd. `https://vcraft-api.onrender.com/api/v1`): chỉ lấy origin. Không đặt biến
 * này thì: dev dùng `http://localhost:4000` (chạy web không qua Caddy), production không tạo rewrite.
 * Rewrite được chốt lúc build nên phải đặt `API_INTERNAL_URL` trước khi build.
 */
export function apiRewrites(
  apiInternalUrl: string | undefined,
  isProduction: boolean,
): ApiRewrite[] {
  const configured = apiInternalUrl?.trim();
  if (!configured && isProduction) return [];
  const origin = new URL(configured || 'http://localhost:4000').origin;
  return [{ source: '/api/:path*', destination: `${origin}/api/:path*` }];
}

export interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * Header bảo mật cho mọi đường dẫn (tương đương khối `header` của routes.caddy và Caddyfile.prod).
 * HSTS chỉ có tác dụng trên HTTPS nên vô hại ở localhost.
 *
 * CSP: hiện chỉ đặt các chỉ thị không cần phân tích script (chống nhúng iframe, đổi base URI, plugin). `script-src` theo nonce cần proxy.ts sinh nonce cho từng request và là việc riêng.
 */
export function securityHeaders(): HeaderRule[] {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=()' },
        {
          key: 'Content-Security-Policy',
          value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
        },
      ],
    },
  ];
}
