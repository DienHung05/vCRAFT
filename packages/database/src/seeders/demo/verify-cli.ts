import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { verifyDemoData } from './verify.js';

/**
 * `pnpm demo:verify`: chỉ đọc. Thoát mã 1 nếu có kiểm tra thất bại.
 * `--offline`: không gửi HEAD tới URL ảnh công khai. `--no-media`: bỏ nhóm kiểm ảnh và giấy tờ (chỉ khi chưa chạy `pnpm demo:media`).
 */
async function main(): Promise<void> {
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const args = new Set(process.argv.slice(2));
    const report = await verifyDemoData(orm.em.fork(), new Date(), {
      media: !args.has('--no-media'),
      checkPublicUrls: !args.has('--offline'),
    });
    for (const check of report.checks) {
      console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name}  [${check.detail}]`);
    }
    console.log(
      report.ok
        ? '\ndemo:verify: dữ liệu demo còn nguyên.'
        : '\ndemo:verify: CÓ KIỂM TRA THẤT BẠI.',
    );
    process.exitCode = report.ok ? 0 : 1;
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:verify thất bại:', error);
  process.exit(1);
});
