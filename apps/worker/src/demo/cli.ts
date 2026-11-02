import 'reflect-metadata';
import { join } from 'node:path';
import { MikroORM, type Options } from '@mikro-orm/core';
import { createMikroOrmOptions, linkDemoMedia } from '@vcraft/database';
import { createObjectStorage } from '@vcraft/storage';
import {
  checkDemoMediaObjects,
  pruneRetiredDemoMedia,
  publishDemoMedia,
} from './publish-demo-media';

/** Thư mục gốc monorepo: tệp này biên dịch thành `apps/worker/dist/demo/cli.js`. */
const ROOT = join(__dirname, '..', '..', '..', '..');

/**
 * `pnpm demo:media`: tải ảnh minh hoạ có giấy phép và giấy tờ mẫu lên object storage (STORAGE_* / S3_*), dựng lại các dòng
 * `media_asset`, nối chúng vào dữ liệu mẫu (`media_link` kèm mô tả vi/en, ảnh bìa, nhật ký và chuỗi băm), gỡ những ảnh
 * đã bị loại khỏi bảng ánh xạ (dòng, liên kết và tệp lưu trữ) rồi in tóm tắt.
 * Chạy lại được (lần hai báo 0 thay đổi); chạy sau mỗi `pnpm demo:reset`. `--dry-run` chỉ tính việc sẽ làm, không ghi gì;
 * `--force` làm lại cả tệp đã có; `--check` chỉ kiểm bucket đúng như CSDL mô tả.
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
  const dryRun = args.has('--dry-run');
  const flag = (name: string) =>
    process.argv
      .slice(2)
      .find((a) => a.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  // Staged rollout on shared data: `--only=links,covers,journal,prune,media` limits the steps and
  // `--journal-products=CODE1,CODE2` limits the journal step to those products.
  const only = flag('only')?.split(',');
  const journalProducts = flag('journal-products')?.split(',');
  const runs = (step: string) => only === undefined || only.includes(step);
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
    const prefix = dryRun ? 'demo:media (dry run)' : 'demo:media';
    const uploaded = !runs('media')
      ? {
          photosUploaded: 0,
          photosSkipped: 0,
          photosMetadataUpdated: 0,
          documentsUploaded: 0,
          documentsSkipped: 0,
        }
      : await publishDemoMedia({
          orm,
          storage,
          imagesDir: join(ROOT, 'apps', 'web', 'public', 'images', 'demo'),
          specimenDir: join(ROOT, 'scripts', 'demo-photos', 'specimen-docs'),
          force: args.has('--force'),
          dryRun,
          log: (message) => console.log(`  ${message}`),
        });
    console.log(`${prefix}: tải lên`, JSON.stringify(uploaded));
    if (dryRun && uploaded.photosUploaded > 0) {
      console.log(
        `${prefix}: còn ảnh chưa tải lên nên bước nối chưa tính được; chạy thật trước, hoặc chạy lại dry run sau.`,
      );
    }
    const linkSteps = (['links', 'covers', 'journal'] as const).filter(runs);
    if (linkSteps.length > 0 && (!dryRun || uploaded.photosUploaded === 0)) {
      const linked = await linkDemoMedia(orm.em.fork(), {
        publicUrl: (key) => storage.publicUrl(key),
        dryRun,
        steps: new Set(linkSteps),
        ...(journalProducts && { journalProducts }),
      });
      console.log(`${prefix}: gắn vào seed`, JSON.stringify(linked));
    }
    if (runs('prune')) {
      const pruned = await pruneRetiredDemoMedia({
        orm,
        storage,
        dryRun,
        log: (message) => console.log(`  ${message}`),
      });
      console.log(`${prefix}: gỡ ảnh đã loại`, JSON.stringify(pruned));
      if (pruned.failed.length > 0) process.exitCode = 1;
    }
    if (!dryRun) {
      const problems = await checkDemoMediaObjects(orm, storage);
      for (const problem of problems) console.error(`FAIL  ${problem}`);
      if (problems.length > 0) process.exitCode = 1;
    }
  } finally {
    await orm.close(true);
  }
}

main().catch((error: unknown) => {
  console.error('demo:media thất bại:', error);
  process.exit(1);
});
