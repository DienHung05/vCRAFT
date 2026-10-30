import 'reflect-metadata';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions } from '../../mikro-orm.config.js';
import { verifyDemoData } from './verify.js';

/** `pnpm demo:verify`: chỉ đọc. Thoát mã 1 nếu có kiểm tra thất bại. */
async function main(): Promise<void> {
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    const report = await verifyDemoData(orm.em.fork());
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
