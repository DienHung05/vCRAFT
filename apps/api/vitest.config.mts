import { defineConfig } from 'vitest/config';

/** Unit test (`pnpm test`): chỉ trong src/. Integration test cần Docker nên chạy riêng bằng `test:integration`. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
