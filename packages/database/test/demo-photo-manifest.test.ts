import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { slugify } from '@vcraft/utils';
import { describe, expect, it } from 'vitest';
import type { MediaVariant } from '../src/entities/index.js';
import { pickDisplayVariant } from '../src/seeders/demo/link-media.js';
import {
  DEMO_PHOTO_LINKS,
  DEMO_PHOTOS,
  NO_COVER_DEMO_HOUSEHOLDS,
  NO_COVER_DEMO_PRODUCTS,
  RETIRED_DEMO_PHOTO_IDS,
} from '../src/seeders/demo/photo-manifest.js';
import { HOUSEHOLDS, NEWS } from '../src/seeders/demo/pools.js';
import { DEMO_VERIFICATION_DOCS } from '../src/seeders/demo/verification-docs.js';

const repoPath = (relative: string) =>
  fileURLToPath(new URL(`../../../${relative}`, import.meta.url));
/** Mã truy xuất cố định của seed (seed-demo.ts `fixedProducts`). */
const SEEDED_TRACE_CODES = new Set(['BT7K2QXM', 'HX2M9KQD', 'DF6P3WZE']);
/** Photos with no cover link: no Commons photo shows that exact object made in Bát Tràng. */
const COVERED_TRACE_CODES = new Set(['BT7K2QXM']);

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

  it('chỉ sản phẩm có ảnh đúng món đồ mới có ảnh bìa; các sản phẩm còn lại dùng hình minh hoạ', () => {
    const covered = DEMO_PHOTO_LINKS.filter((l) => l.target === 'PRODUCT' && l.role === 'COVER');
    expect(new Set(covered.map((l) => l.key))).toEqual(COVERED_TRACE_CODES);
    expect(covered.find((l) => l.key === 'BT7K2QXM')?.photo).toBe('binh-men-lam-xam');
    for (const code of NO_COVER_DEMO_PRODUCTS) {
      expect(SEEDED_TRACE_CODES.has(code), code).toBe(true);
      expect(COVERED_TRACE_CODES.has(code), code).toBe(false);
    }
  });

  it('hộ không còn ảnh bìa thì không có liên kết BANNER và vẫn có trong seed', () => {
    const householdSlugs = new Set(HOUSEHOLDS.map((h) => slugify(h.name)));
    for (const slug of NO_COVER_DEMO_HOUSEHOLDS) {
      expect(householdSlugs.has(slug), slug).toBe(true);
      expect(
        DEMO_PHOTO_LINKS.some(
          (l) => l.target === 'HOUSEHOLD' && l.key === slug && l.role === 'BANNER',
        ),
        slug,
      ).toBe(false);
    }
  });

  it('mỗi liên kết có mô tả tiếng Việt và tiếng Anh khác nhau, và mỗi ảnh được gắn ít nhất một chỗ', () => {
    for (const link of DEMO_PHOTO_LINKS) {
      expect(link.alt.trim().length, link.photo).toBeGreaterThan(10);
      expect(link.altEn.trim().length, link.photo).toBeGreaterThan(10);
      expect(link.altEn, link.photo).not.toBe(link.alt);
      expect(link.altEn, link.photo).toMatch(/^[\x20-\x7e]+$/);
    }
    const linked = new Set(DEMO_PHOTO_LINKS.map((l) => l.photo));
    for (const photo of DEMO_PHOTOS) expect(linked.has(photo.id), photo.id).toBe(true);
  });

  it('ảnh đã gỡ không còn trong bảng ánh xạ, trên đĩa hay trong thư mục ảnh của web', () => {
    const ids = new Set(DEMO_PHOTOS.map((p) => p.id));
    for (const id of RETIRED_DEMO_PHOTO_IDS) {
      expect(ids.has(id), id).toBe(false);
      for (const width of [640, 1280]) {
        expect(existsSync(repoPath(`apps/web/public/images/demo/${id}-${width}.webp`)), id).toBe(
          false,
        );
      }
    }
    // Generic stage photos must never come back as a stand-in for a product's own photo.
    for (const id of ids) expect(id, id).not.toMatch(/^(tl|sq)-/);
  });

  it('giấy tờ mẫu có tệp và nằm riêng tư (ba loại, mô tả ghi rõ là bản mẫu)', () => {
    expect(DEMO_VERIFICATION_DOCS).toHaveLength(3);
    for (const doc of DEMO_VERIFICATION_DOCS) {
      expect(existsSync(repoPath(`scripts/demo-photos/specimen-docs/${doc.id}.png`)), doc.id).toBe(
        true,
      );
      expect(doc.altText).toMatch(/MẪU – KHÔNG CÓ GIÁ TRỊ/);
      expect(doc.altTextEn.trim().length, doc.id).toBeGreaterThan(10);
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
