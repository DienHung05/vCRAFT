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

/** Same-origin path under which the web serves public Storage files (see `app/media-cache`). */
export const MEDIA_PROXY_PREFIX = '/media-cache';

const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/';

/**
 * Public Storage URL behind a `/media-cache/<path>` request; null when Storage is not configured or the
 * path is unsafe. Only the project's own public Storage is ever reachable.
 */
export function storageUrlFor(
  path: readonly string[],
  supabaseUrl: string | undefined,
): string | null {
  const configured = supabaseUrl?.trim();
  if (!configured || path.length === 0) return null;
  if (path.some((segment) => segment === '' || segment === '.' || segment === '..')) return null;
  try {
    const storageOrigin = new URL(configured).origin;
    return `${storageOrigin}${STORAGE_PUBLIC_PATH}${path.map(encodeURIComponent).join('/')}`;
  } catch {
    return null;
  }
}

/**
 * Same-origin form of a public Storage URL (`https://<ref>.supabase.co/storage/v1/object/public/<path>`
 * becomes `/media-cache/<path>`); any other URL, or an unset `supabaseUrl`, comes back unchanged.
 * Lighthouse (simulated throttling) charges a cross-origin LCP image a full DNS + TCP + TLS handshake and
 * counts every font and script that finished before the image painted, so the hero is served from the
 * page's own warm origin and from a cache (see `app/media-cache/[...path]/route.ts`).
 */
export function sameOriginMediaUrl(url: string, supabaseUrl: string | undefined): string {
  const configured = supabaseUrl?.trim();
  if (!configured) return url;
  try {
    const prefix = `${new URL(configured).origin}${STORAGE_PUBLIC_PATH}`;
    return url.startsWith(prefix) ? `${MEDIA_PROXY_PREFIX}/${url.slice(prefix.length)}` : url;
  } catch {
    return url;
  }
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
