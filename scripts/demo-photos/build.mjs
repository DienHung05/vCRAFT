#!/usr/bin/env node
/**
 * Tải ảnh minh hoạ trình diễn từ Wikimedia Commons, cắt theo tỉ lệ khung, mã hoá AVIF + WebP
 * (640w, 1280w) vào apps/web/public/images/demo và sinh apps/web/src/lib/demo/photo-credits.ts.
 *
 * Dùng: node scripts/demo-photos/build.mjs [thư-mục-ảnh-gốc]
 * Ảnh gốc tải về thư mục đối số (mặc định thư mục tạm của hệ điều hành, ngoài repo). Cùng thiết lập với bộ chuyển
 * ảnh của worker (xoay theo EXIF, bỏ metadata, AVIF q50, WebP q75), không phóng to ảnh.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(path.join(root, 'apps/worker/package.json'));
const sharp = require('sharp');

const srcDir = process.argv[2] ?? path.join(os.tmpdir(), 'vcraft-demo-photos-src');
const outDir = path.join(root, 'apps/web/public/images/demo');
const creditsFile = path.join(root, 'apps/web/src/lib/demo/photo-credits.ts');
const UA = 'vCraftDemo/1.0 (https://github.com/DienHung05/vCRAFT)';
const { widths, photos } = JSON.parse(fs.readFileSync(path.join(here, 'sources.json'), 'utf8'));

fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

/** JPEG / PNG / WebP theo byte đầu, không tin phần mở rộng hay content-type. */
function isRealImage(buf) {
  if (buf.length < 12) return false;
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp =
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP';
  return jpeg || png || webp;
}

async function download(p) {
  // Cache theo tên file nguồn: nhiều id có thể cắt khác nhau từ cùng một ảnh gốc.
  const dest = path.join(srcDir, `${crypto.createHash('md5').update(p.file).digest('hex')}.src`);
  if (fs.existsSync(dest)) return fs.readFileSync(dest);
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p.file.replaceAll(' ', '_'))}?width=2000`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (!isRealImage(buf)) throw new Error(`${p.id}: không phải JPEG/PNG/WebP`);
      fs.writeFileSync(dest, buf);
      await new Promise((r) => setTimeout(r, 1500)); // nhẹ tay với Wikimedia
      return buf;
    }
    if (attempt === 5) throw new Error(`${p.id}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

const hex = (n) => Math.round(n).toString(16).padStart(2, '0');
const credits = [];
let total = 0;

for (const p of photos) {
  const buf = await download(p);
  if (!isRealImage(buf)) throw new Error(`${p.id}: byte không hợp lệ`);
  const [rw, rh] = p.ratio.split('/').map(Number);
  const { data } = await sharp(buf, { limitInputPixels: 80_000_000, failOn: 'error' })
    .rotate()
    .toBuffer({ resolveWithObject: true });
  const oriented = sharp(data);
  const meta = await oriented.metadata();
  const ow = meta.width;
  const oh = meta.height;
  // Cắt lớn nhất có thể theo tỉ lệ khung, rồi thu nhỏ.
  const cropW = Math.min(ow, Math.floor((oh * rw) / rh));
  const cropH = Math.round((cropW * rh) / rw);
  const cover = oriented.clone().resize({
    width: cropW,
    height: cropH,
    fit: 'cover',
    position: p.position ?? sharp.strategy.attention,
  });
  const cropped = await cover.toBuffer();
  const wanted = p.widths ?? widths;
  const { channels } = await sharp(cropped).stats();
  // Màu trung bình (ổn định hơn mốc histogram `dominant`, vốn có thể ra gần đen/trắng).
  const dominant = { r: channels[0].mean, g: channels[1].mean, b: channels[2].mean };
  for (const w of wanted) {
    if (w > cropW && w !== wanted[0]) continue; // không phóng to
    const target = Math.min(w, cropW);
    const resized = sharp(cropped).resize({ width: target, withoutEnlargement: true });
    const avif = await resized.clone().avif({ quality: 50, effort: 4 }).toBuffer();
    const webp = await resized.clone().webp({ quality: 75 }).toBuffer();
    // Tên theo chiều rộng danh nghĩa; nếu ảnh nhỏ hơn 640 thì file 640 vẫn là kích thước gốc.
    fs.writeFileSync(path.join(outDir, `${p.id}-${w}.avif`), avif);
    fs.writeFileSync(path.join(outDir, `${p.id}-${w}.webp`), webp);
    total += avif.length + webp.length;
  }
  const has1280 = cropW >= 1280;
  const outWidths = wanted.filter((w) => w <= cropW || w === wanted[0]);
  // Tên 1280 chỉ ghi khi đủ điểm ảnh; dọn file thừa từ lần chạy trước.
  if (!has1280) {
    for (const ext of ['avif', 'webp'])
      fs.rmSync(path.join(outDir, `${p.id}-1280.${ext}`), { force: true });
  }
  const page = `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file.replaceAll(' ', '_')).replaceAll('%2C', ',').replaceAll('%3A', ':')}`;
  credits.push({
    id: p.id,
    title: `File:${p.file}`,
    author: p.author,
    license: p.license,
    licenseUrl: p.licenseUrl,
    sourceUrl: page,
    ratio: p.ratio,
    tint: `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`,
    widths: outWidths,
  });
  console.log(p.id, `${ow}x${oh} -> ${cropW}x${cropH}`, credits.at(-1).tint, outWidths.join('/'));
}

const body = `// Sinh tự động bởi scripts/demo-photos/build.mjs. Không sửa tay; sửa sources.json rồi chạy lại.
// Ảnh minh hoạ trình diễn lấy từ Wikimedia Commons, chỉ dùng giấy phép CC0 / CC BY / CC BY-SA.

export interface PhotoCredit {
  /** Tên file trong /images/demo: \`<id>-<width>.<avif|webp>\`. */
  id: string;
  /** Tên trang file trên Wikimedia Commons. */
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** Trang mô tả file (nguồn và lịch sử). */
  sourceUrl: string;
  /** Tỉ lệ khung đã cắt, dạng CSS (\`4/5\`). */
  ratio: '3/2' | '3/4' | '1/1' | '4/5' | '16/9';
  /** Màu chủ đạo, dùng làm nền trong lúc ảnh tải. */
  tint: string;
  /** Các chiều rộng đã sinh. */
  widths: readonly number[];
}

export const PHOTO_CREDITS: readonly PhotoCredit[] = ${JSON.stringify(credits, null, 2)};

export const PHOTO_BY_ID: ReadonlyMap<string, PhotoCredit> = new Map(
  PHOTO_CREDITS.map((p) => [p.id, p]),
);
`;
fs.writeFileSync(creditsFile, body);
console.log(`Tổng dung lượng: ${(total / 1024 / 1024).toFixed(2)} MB`);
