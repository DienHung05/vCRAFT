#!/usr/bin/env node
/**
 * Xuất bảng ánh xạ ảnh minh hoạ → sản phẩm / hộ / tin / mốc nhật ký của dữ liệu mẫu trong CSDL
 * (packages/database/src/seeders/demo/photo-manifest.ts) từ chính dữ liệu minh họa tĩnh của apps/web
 * (`data.ts`, `stage-photos.ts`, `photo-credits.ts`), để ánh xạ đã sửa ở GH#25 được giữ nguyên.
 *
 * Dùng: pnpm --filter @vcraft/domain run build && node scripts/demo-photos/export-manifest.mjs
 * Chạy lại được khi dữ liệu web đổi. Khi trang công khai chuyển sang API (GH#28) và dữ liệu minh họa của web bị
 * xóa, file manifest trở thành nguồn duy nhất và script này có thể bỏ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const demoDir = path.join(root, 'apps/web/src/lib/demo');
const imagesDir = path.join(root, 'apps/web/public/images/demo');
const out = path.join(root, 'packages/database/src/seeders/demo/photo-manifest.ts');

const data = await import(pathToFileURL(path.join(demoDir, 'data.ts')).href);
const credits = await import(pathToFileURL(path.join(demoDir, 'photo-credits.ts')).href);
const stages = await import(pathToFileURL(path.join(demoDir, 'stage-photos.ts')).href);

/** Tin của web → khóa tin trong seed (`NEWS` của pools.ts): chỉ ghép khi ảnh khớp đúng nội dung bài. */
const NEWS_KEY = {
  'hoi-cho-gom-mua-dong': 'village-lantern',
  'lop-vuot-gom-cuoi-tuan': 'h7-class',
  'gia-dat-set-quy-4': 'village-clay-month',
};
/** Sản phẩm của web chưa có trong seed (không ghép được): `LN4R8TPA` Ấm trà men ngọc. */
const SEEDED_CODES = new Set(['BT7K2QXM', 'HX2M9KQD', 'DF6P3WZE']);
const STAGES = ['clay', 'throw', 'dry', 'paint', 'glaze', 'fire', 'finish'];

const photos = new Map(); // id -> { id, alt, credit, widths }
const links = [];

function use(ref) {
  const credit = credits.PHOTO_BY_ID.get(ref.id);
  if (!credit) throw new Error(`Thiếu ghi nhận cho ảnh ${ref.id}`);
  for (const w of credit.widths) {
    if (!fs.existsSync(path.join(imagesDir, `${ref.id}-${w}.webp`)))
      throw new Error(`Thiếu file ${ref.id}-${w}.webp`);
  }
  if (!photos.has(ref.id)) {
    photos.set(ref.id, {
      id: ref.id,
      alt: ref.alt,
      credit: {
        title: credit.title,
        author: credit.author,
        license: credit.license,
        licenseUrl: credit.licenseUrl,
        sourceUrl: credit.sourceUrl,
      },
      widths: [...credit.widths],
    });
  }
}

function link(photo, target, key, role, position, alt, caption) {
  links.push({ photo, target, key, role, position, alt, ...(caption && { caption }) });
}

for (const a of await data.getArtisans()) {
  // Slug của nghệ nhân trong web trùng slug hộ trong seed (slugify tên hộ).
  if (a.portrait) {
    use(a.portrait);
    link(a.portrait.id, 'HOUSEHOLD', a.slug, 'PORTRAIT', 0, a.portrait.alt);
  }
  if (a.banner) {
    use(a.banner);
    link(a.banner.id, 'HOUSEHOLD', a.slug, 'BANNER', 0, a.banner.alt);
  }
  for (const [position, shot] of a.gallery.entries()) {
    if (!shot.photo) continue;
    use(shot.photo);
    link(shot.photo.id, 'HOUSEHOLD', a.slug, 'GALLERY', position, shot.photo.alt, shot.caption);
  }
}
for (const p of await data.getProducts()) {
  if (!p.photo || !SEEDED_CODES.has(p.code)) continue;
  use(p.photo);
  link(p.photo.id, 'PRODUCT', p.code, 'COVER', 0, p.photo.alt);
}
for (const n of await data.getNews()) {
  const key = NEWS_KEY[n.slug];
  if (!n.photo || !key) continue;
  use(n.photo);
  link(n.photo.id, 'NEWS', key, 'COVER', 0, n.photo.alt);
}
const stagePhotos = {};
for (const stage of STAGES) {
  const ref = stages.timelinePhoto(stage, false);
  use(ref);
  stagePhotos[stage] = ref.id;
}

const body = `// Sinh bởi scripts/demo-photos/export-manifest.mjs từ dữ liệu minh họa của apps/web; chạy lại script khi dữ liệu web đổi.
// Ảnh Bát Tràng minh hoạ từ Wikimedia Commons (CC0 / CC BY / CC BY-SA), tệp nằm ở apps/web/public/images/demo.

import type { JournalStage } from '@vcraft/domain';
import type { MediaCredit, MediaLinkRole, MediaLinkTarget } from '../../entities/index.js';

export interface DemoPhoto {
  /** Tên gốc tệp trong apps/web/public/images/demo: \`<id>-<width>.webp\`. */
  id: string;
  /** Mô tả mặc định (chỗ dùng đầu tiên); mỗi liên kết có thể ghi đè. */
  alt: string;
  credit: MediaCredit;
  /** Các chiều rộng có sẵn trong thư mục ảnh; bản lớn nhất làm đầu vào của đường xử lý ảnh. */
  widths: readonly number[];
}

export interface DemoPhotoLink {
  photo: string;
  target: MediaLinkTarget;
  /** \`traceCode\` (sản phẩm), \`slug\` (hộ) hoặc khóa tin trong \`NEWS\` của pools.ts. */
  key: string;
  role: MediaLinkRole;
  position: number;
  alt: string;
  caption?: string;
}

export const DEMO_PHOTOS: readonly DemoPhoto[] = ${JSON.stringify([...photos.values()], null, 2)};

export const DEMO_PHOTO_LINKS: readonly DemoPhotoLink[] = ${JSON.stringify(links, null, 2)};

/** Ảnh minh hoạ cho từng công đoạn (không phải ảnh chụp đúng món đồ); gắn vào \`JournalEntry.images\`. */
export const DEMO_STAGE_PHOTOS: Readonly<Record<JournalStage, string>> = ${JSON.stringify(stagePhotos, null, 2)};
`;
fs.writeFileSync(out, body);
console.log(
  `${photos.size} ảnh, ${links.length} liên kết, ${STAGES.length} công đoạn -> ${path.relative(root, out)}`,
);
