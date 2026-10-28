import { defineConfig, devices } from '@playwright/test';

/**
 * Cổng web mặc định khi chạy local/CI. Đặt `E2E_BASE_URL` để chạy với một bản đã triển khai sẵn
 * (khi đó không tự khởi động server).
 */
const PORT = 3000;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Chạy bản đã build (`pnpm --filter @vcraft/web build` phải xong trước; CI build ở bước trước e2e).
  // Local: dùng lại server đang chạy nếu có.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm --filter @vcraft/web start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
