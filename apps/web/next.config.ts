import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { apiRewrites, securityHeaders } from './src/lib/deploy-config';

// Đọc cấu hình theo request ở src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Package nội bộ export thẳng mã TypeScript (mô hình just-in-time, xem ARCHITECTURE §3.2)
  transpilePackages: [
    '@vcraft/api-client',
    '@vcraft/contracts',
    '@vcraft/domain',
    '@vcraft/i18n',
    '@vcraft/ui',
    '@vcraft/utils',
  ],
  reactCompiler: true,
  // No `X-Powered-By: Next.js`: it only tells an attacker which framework to probe (OWASP A05).
  poweredByHeader: false,
  // `forbidden()` + `forbidden.tsx` cho trang 403 của khu vực theo vai trò (lib/auth/guard.ts)
  // `inlineCss`: the ~25 KB of CSS ships inside the HTML instead of three render-blocking stylesheet
  // requests that delay the first paint on a slow link (GH#481). The CSP already allows inline styles.
  experimental: { authInterrupts: true, inlineCss: true },
  // Dùng một AGENTS.md duy nhất ở gốc repo, không để `next dev` sinh thêm bản riêng
  agentRules: false,
  // Vercel không có Caddy: Next chuyển tiếp /api/* sang API (Render) và đặt header bảo mật (ADR-16).
  rewrites: async () =>
    apiRewrites(process.env.API_INTERNAL_URL, process.env.NODE_ENV === 'production'),
  headers: async () => securityHeaders(),
};

export default withNextIntl(nextConfig);
