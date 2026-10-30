import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { evaluateDemoResetGuard, formatDemoGuardRefusal } from './guard.js';
import { clearBusinessData } from './reset.js';
import { seedDemoData } from './seed-demo.js';

/**
 * `pnpm demo:reset`: xóa bảng nghiệp vụ rồi nạp lại dữ liệu mẫu. Cổng chặn chạy TRƯỚC khi mở kết nối.
 * Bị từ chối ⇒ in lý do, thoát mã 2, không chạm CSDL.
 */
async function main(): Promise<void> {
  const guard = evaluateDemoResetGuard(process.env);
  if (!guard.allowed) {
    console.error(formatDemoGuardRefusal(guard));
    process.exit(2);
  }
  console.log(`demo:reset: được phép, đích ${guard.target}`);

  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const em = orm.em.fork();
    await em.transactional(async (tx) => {
      await clearBusinessData(tx);
      const summary = await seedDemoData(tx);
      console.log('demo:reset: đã nạp', JSON.stringify(summary));
    });
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:reset thất bại:', error);
  process.exit(1);
});
