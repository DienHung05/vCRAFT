#!/usr/bin/env node
/**
 * Pre-exam: ảnh ~12 MB sau khi qua đường xử lý của worker phải ra tệp ≤ 1,5 MB mỗi biến thể.
 *
 * Tạo một ảnh JPEG giả ảnh chụp điện thoại (6000×4000, có nhiễu, ≥ 12 MiB), gọi ĐÚNG `convertImage` của
 * apps/worker rồi in kích thước từng biến thể AVIF/WebP. Không cần mạng hay CSDL.
 * Dùng ảnh thật: `pnpm demo:check:media -- --file duong/dan/anh.jpg` (cần ≥ 12 MiB để tính là đạt).
 * Lưu ý: API chặn tệp > 10 MB (MEDIA_MAX_BYTES); ảnh 12 MB thật được trình duyệt nén trước khi gửi.
 * Script này kiểm phần còn lại của chuỗi (worker). Phần nén phía trình duyệt kiểm bằng tay (docs/demo/README.md).
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { importFrom, printResult, ROOT } from './lib/demo-common.mjs';

const MIN_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const sharp = (await importFrom('apps/worker', 'sharp')).default;
const { convertImage } = await import(
  pathToFileURL(join(ROOT, 'apps/worker/src/processors/media/convert-image.ts')).href
);

const fileFlag = process.argv.indexOf('--file');
const realFile = fileFlag > 0 ? process.argv[fileFlag + 1] : undefined;

/** Ảnh giả ảnh chụp điện thoại: nền chuyển sắc + nhiễu xác định, nén JPEG tới khi ≥ 12 MiB. */
async function syntheticPhoto() {
  const width = 6000;
  const height = 4000;
  const raw = Buffer.alloc(width * height * 3);
  let seed = 20261101;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const base = 128 + 60 * Math.sin(x / 300) + 50 * Math.cos(y / 200);
      raw[i] = base + noise() * 60;
      raw[i + 1] = base * 0.9 + noise() * 60;
      raw[i + 2] = base * 0.7 + noise() * 60;
    }
  }
  let jpeg = Buffer.alloc(0);
  for (let quality = 88; quality <= 99 && jpeg.length < MIN_INPUT_BYTES; quality++) {
    jpeg = await sharp(raw, { raw: { width, height, channels: 3 } })
      .jpeg({ quality })
      .toBuffer();
  }
  return jpeg;
}

const original = realFile ? await readFile(realFile) : await syntheticPhoto();
printResult(
  'Ảnh đầu vào ≥ 12 MiB',
  original.length >= MIN_INPUT_BYTES,
  `${mb(original.length)}${realFile ? ` (${realFile})` : ', 6000x4000 giả lập'}`,
);

const started = performance.now();
const result = await convertImage(new Uint8Array(original));
const seconds = ((performance.now() - started) / 1000).toFixed(1);
let ok = original.length >= MIN_INPUT_BYTES;
for (const variant of result.variants) {
  const fits = variant.bytes.byteLength <= MAX_OUTPUT_BYTES;
  ok &&= fits;
  printResult(`${variant.format} ${variant.width}px`, fits, mb(variant.bytes.byteLength));
}
const largest = Math.max(...result.variants.map((v) => v.bytes.byteLength));
console.log(
  `\nBiến thể lớn nhất ${mb(largest)} (giới hạn ${mb(MAX_OUTPUT_BYTES)}); xử lý ${seconds}s.`,
);
console.log(ok ? 'demo:check:media: ĐẠT' : 'demo:check:media: KHÔNG ĐẠT');
process.exit(ok ? 0 : 1);
