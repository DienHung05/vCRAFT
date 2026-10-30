import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { seedDemoData } from './demo/seed-demo.js';

/**
 * Nạp dữ liệu mẫu vào CSDL TRỐNG cho môi trường dev/demo. Từ chối khi `APP_ENV` không phải
 * `development` hoặc `demo`, để `pnpm db:seed` lỡ chạy trên production không đổ dữ liệu mẫu vào.
 * Nạp lại từ đầu: `pnpm demo:reset` (có cổng chặn riêng).
 */
export class DemoSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    const appEnv = process.env.APP_ENV?.trim().toLowerCase();
    if (appEnv !== 'development' && appEnv !== 'demo') {
      console.warn(
        `db:seed bỏ qua dữ liệu mẫu: APP_ENV=${appEnv ?? '(chưa đặt)'}; đặt APP_ENV=development hoặc demo để nạp.`,
      );
      return;
    }
    const summary = await seedDemoData(em);
    console.log('db:seed đã nạp dữ liệu mẫu', JSON.stringify(summary));
  }
}
