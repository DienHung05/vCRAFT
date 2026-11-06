import { fileURLToPath } from 'node:url';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration test chạy CSDL thật trong container (Testcontainers) theo `DB_DRIVER=postgresql|mysql`.
 * Cần Docker daemon; không có Docker thì test thất bại (không bỏ qua im lặng).
 *
 * Các package workspace được trỏ thẳng vào mã nguồn để không phải build trước; entity dùng decorator
 * kiểu cũ nên cần SWC biên dịch (bật `decoratorMetadata` cho DI của NestJS khi test dựng cả ứng dụng).
 */
export default defineConfig({
  plugins: [
    swc.vite({
      swcrc: false, // bỏ .swcrc (commonjs, dành cho nest build); test cần ESM
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
    }),
  ],
  resolve: {
    alias: Object.fromEntries(
      ['contracts', 'database', 'domain', 'knowledge', 'storage', 'utils'].map((name) => [
        `@vcraft/${name}`,
        fileURLToPath(new URL(`../../packages/${name}/src/index.ts`, import.meta.url)),
      ]),
    ),
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 240_000, // kéo image + khởi động container + chạy migration
    // Mỗi file dựng container riêng; chạy tuần tự để CI nhỏ không bị cạn bộ nhớ
    fileParallelism: false,
    passWithNoTests: false,
  },
});
