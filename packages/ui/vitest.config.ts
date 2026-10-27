import { defineConfig } from 'vitest/config';

export default defineConfig({
  // tsconfig dùng chung đặt jsx: "preserve" (cho Next); test cần biên dịch JSX thật.
  oxc: { jsx: { runtime: 'automatic' } },
  test: { include: ['test/**/*.test.{ts,tsx}'] },
});
