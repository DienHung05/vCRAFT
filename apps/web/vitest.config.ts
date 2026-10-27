import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig dùng chung đặt jsx: "preserve" (cho Next); test cần biên dịch JSX thật.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
