import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JOURNAL_STAGES } from '@vcraft/domain';
import { slugify } from '@vcraft/utils';
import { describe, expect, it } from 'vitest';
import type { MediaVariant } from '../src/entities/index.js';
import { pickDisplayVariant } from '../src/seeders/demo/link-media.js';
import {
  DEMO_PHOTO_LINKS,
  DEMO_PHOTOS,
  DEMO_STAGE_PHOTOS,
} from '../src/seeders/demo/photo-manifest.js';
import { HOUSEHOLDS, NEWS } from '../src/seeders/demo/pools.js';
import { DEMO_VERIFICATION_DOCS } from '../src/seeders/demo/verification-docs.js';

const repoPath = (relative: string) =>
  fileURLToPath(new URL(`../../../${relative}`, import.meta.url));
/** Mã truy xuất cố định của seed (seed-demo.ts `fixedProducts`). */
const SEEDED_TRACE_CODES = new Set(['BT7K2QXM', 'HX2M9KQD', 'DF6P3WZE']);

describe('bảng ánh xạ ảnh của dữ liệu mẫu', () => {
  const photos = new Map(DEMO_PHOTOS.map((p) => [p.id, p]));

  it('mỗi ảnh có mô tả, ghi công đủ (tác giả, giấy phép CC/CC0, nguồn) và tệp thật trên đĩa', () => {
    expect(photos.size).toBe(DEMO_PHOTOS.length);
    for (const photo of DEMO_PHOTOS) {
      expect(photo.alt.trim().length, photo.id).toBeGreaterThan(10);
      expect(photo.credit.author.trim(), photo.id).not.toBe('');
      expect(photo.credit.license, photo.id).toMatch(/^CC/);
      expect(photo.credit.licenseUrl, photo.id).toMatch(/^https:\/\/creativecommons\.org\//);
      expect(photo.credit.sourceUrl, photo.id).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      const widest = Math.max(...photo.widths);
      expect(
        existsSync(repoPath(`apps/web/public/images/demo/${photo.id}-${widest}.webp`)),
        photo.id,
      ).toBe(true);
    }
  });

  it('mọi liên kết trỏ tới ảnh có thật, tới hộ/sản phẩm/tin có trong seed và không trùng chỗ', () => {
    const householdSlugs = new Set(HOUSEHOLDS.map((h) => slugify(h.name)));
    const newsKeys = new Set(NEWS.map((n) => n.key));
    const slots = new Set<string>();
    for (const link of DEMO_PHOTO_LINKS) {
      expect(photos.has(link.photo), link.photo).toBe(true);
      if (link.target === 'HOUSEHOLD') expect(householdSlugs.has(link.key), link.key).toBe(true);
      if (link.target === 'PRODUCT') expect(SEEDED_TRACE_CODES.has(link.key), link.key).toBe(true);
      if (link.target === 'NEWS') expect(newsKeys.has(link.key), link.key).toBe(true);
      const slot = `${link.target}|${link.key}|${link.role}|${link.position}`;
      expect(slots.has(slot), slot).toBe(false);
      slots.add(slot);
    }
  });

  it('giữ ánh xạ đã sửa ở GH#25: ba sản phẩm có đúng ảnh của mình', () => {
    const cover = (code: string) =>
      DEMO_PHOTO_LINKS.find((l) => l.target === 'PRODUCT' && l.key === code && l.role === 'COVER');
    expect(cover('BT7K2QXM')?.photo).toBe('binh-men-lam-xam');
    expect(cover('HX2M9KQD')?.photo).toBe('bat-ve-sen-men-trong');
    expect(cover('DF6P3WZE')?.photo).toBe('coc-men-trang-quai-tron');
  });

  it('mỗi công đoạn nhật ký có ảnh minh hoạ', () => {
    for (const stage of JOURNAL_STAGES) {
      const id = DEMO_STAGE_PHOTOS[stage];
      expect(photos.has(id), stage).toBe(true);
      expect(photos.get(id)?.alt, stage).toMatch(/^Ảnh minh hoạ/);
    }
  });

  it('giấy tờ mẫu có tệp và nằm riêng tư (ba loại, mô tả ghi rõ là bản mẫu)', () => {
    expect(DEMO_VERIFICATION_DOCS).toHaveLength(3);
    for (const doc of DEMO_VERIFICATION_DOCS) {
      expect(existsSync(repoPath(`scripts/demo-photos/specimen-docs/${doc.id}.png`)), doc.id).toBe(
        true,
      );
      expect(doc.altText).toMatch(/MẪU – KHÔNG CÓ GIÁ TRỊ/);
    }
  });
});

describe('pickDisplayVariant', () => {
  const variant = (format: 'avif' | 'webp', width: number): MediaVariant => ({
    format,
    width,
    height: width,
    key: `v/x/${width}.${format}`,
    bytes: 1,
  });

  it('chọn WebP gần 640px nhất, bỏ AVIF', () => {
    expect(
      pickDisplayVariant([
        variant('avif', 640),
        variant('webp', 320),
        variant('webp', 1280),
        variant('webp', 640),
      ])?.key,
    ).toBe('v/x/640.webp');
    expect(pickDisplayVariant([variant('webp', 320), variant('webp', 1280)])?.width).toBe(320);
  });

  it('không có WebP thì không chọn gì', () => {
    expect(pickDisplayVariant([variant('avif', 640)])).toBeUndefined();
    expect(pickDisplayVariant([])).toBeUndefined();
  });
});
