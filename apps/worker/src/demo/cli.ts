import 'reflect-metadata';
import { join } from 'node:path';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions, linkDemoMedia } from '@vcraft/database';
import { createObjectStorage } from '@vcraft/storage';
import { checkDemoMediaObjects, publishDemoMedia } from './publish-demo-media';

/** Thư mục gốc monorepo: tệp này biên dịch thành `apps/worker/dist/demo/cli.js`. */
const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * `pnpm demo:media`: tải ảnh minh hoạ có giấy phép và giấy tờ mẫu lên object storage (STORAGE_* / S3_*), dựng lại các dòng
 * `media_asset`, nối chúng vào dữ liệu mẫu (`media_link`, `JournalEntry.images`, chuỗi băm) rồi in tóm tắt.
 * Chạy lại được; chạy sau mỗi `pnpm demo:reset`. `--force` làm lại cả tệp đã có; `--check` chỉ kiểm bucket đúng như CSDL mô tả.
 * Chỉ chạy khi `APP_ENV` là `demo` hoặc `development`: bước này niêm phong lại chuỗi băm nhật ký của dữ liệu mẫu.
 */
async function main(): Promise<void> {
  const appEnv = process.env.APP_ENV?.trim();
  if (appEnv !== 'demo' && appEnv !== 'development') {
    console.error(
      `demo:media chỉ chạy khi APP_ENV là demo hoặc development (hiện: "${appEnv ?? ''}"). Không đụng tới dữ liệu.`,
    );
    process.exit(2);
  }
  const args = new Set(process.argv.slice(2));
  const storage = createObjectStorage(process.env);
  const orm = await MikroORM.init(createMikroOrmOptions(process.env) as unknown as Options);
  try {
    if (args.has('--check')) {
      const problems = await checkDemoMediaObjects(orm, storage);
      for (const problem of problems) console.error(`FAIL  ${problem}`);
      console.log(
        problems.length === 0
          ? 'demo:media --check: bucket khớp CSDL.'
          : 'demo:media --check: LỆCH.',
      );
      process.exitCode = problems.length === 0 ? 0 : 1;
      return;
    }
    const uploaded = await publishDemoMedia({
      orm,
      storage,
      imagesDir: join(ROOT, 'apps', 'web', 'public', 'images', 'demo'),
      specimenDir: join(ROOT, 'scripts', 'demo-photos', 'specimen-docs'),
      force: args.has('--force'),
      log: (message) => console.log(`  ${message}`),
    });
    console.log('demo:media: đã tải lên', JSON.stringify(uploaded));
    const linked = await linkDemoMedia(orm.em.fork(), {
      publicUrl: (key) => storage.publicUrl(key),
    });
    console.log('demo:media: đã gắn vào seed', JSON.stringify(linked));
    const problems = await checkDemoMediaObjects(orm, storage);
    for (const problem of problems) console.error(`FAIL  ${problem}`);
    if (problems.length > 0) process.exitCode = 1;
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:media thất bại:', error);
  process.exit(1);
});
