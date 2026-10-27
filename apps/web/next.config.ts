import type { NextConfig } from 'next';

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
  // Dùng một AGENTS.md duy nhất ở gốc repo, không để `next dev` sinh thêm bản riêng
  agentRules: false,
};

export default nextConfig;
