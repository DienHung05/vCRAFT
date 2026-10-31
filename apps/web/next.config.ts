import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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
  // `forbidden()` + `forbidden.tsx` cho trang 403 của khu vực theo vai trò (lib/auth/guard.ts)
  experimental: { authInterrupts: true },
  // Dùng một AGENTS.md duy nhất ở gốc repo, không để `next dev` sinh thêm bản riêng
  agentRules: false,
};

export default withNextIntl(nextConfig);
