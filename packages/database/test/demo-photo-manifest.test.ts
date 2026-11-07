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
/**
 * Trace codes of the seed use the API's alphabet. The generated ones are stable across resets because the seed's
 * random generator has a fixed seed; `demo:media` fails on a code that is not in the database
 * (`findOneOrFail`) and the demo-seed integration test links every photo against a fresh seed.
 */
const TRACE_CODE = /^[2-9A-HJKMNP-Z]{8}$/;
/** Products with a photo from before the product-photo round (they keep their Commons photos). */
const EARLIER_COVERED_TRACE_CODES = ['BT7K2QXM', '84PZKVJU'];
/** Product photos of vCRAFT-83g.48 (74) and vCRAFT-83g.52 (146): one `pp-<trace code>` photo per product. */
const PRODUCT_PHOTO_COUNT = 220;

describe('bảng ánh xạ ảnh của dữ liệu mẫu', () => {
  const photos = new Map(DEMO_PHOTOS.map((p) => [p.id, p]));

  it('mỗi ảnh có mô tả, ghi công đủ (tác giả, giấy phép CC/CC0, nguồn) và tệp thật trên đĩa', () => {
    expect(photos.size).toBe(DEMO_PHOTOS.length);
    for (const photo of DEMO_PHOTOS) {
      expect(photo.alt.trim().length, photo.id).toBeGreaterThan(10);
      expect(photo.credit.author.trim(), photo.id).not.toBe('');
      expect(photo.credit.license.trim(), photo.id).not.toBe('');
      // Allow empty licenseUrl for 'unknown' license photos
      if (photo.credit.licenseUrl) {
        expect(photo.credit.licenseUrl, photo.id).toMatch(
          /^https:\/\/(creativecommons\.org|pixabay\.com)\//,
        );
      }
      // sourceUrl must exist and be valid (CC sources or e-commerce sites)
      expect(photo.credit.sourceUrl, photo.id).toMatch(/^https?:\/\//);
      if (photo.credit.license !== 'unknown') {
        expect(photo.credit.sourceUrl, photo.id).toMatch(
          /^https:\/\/(commons\.wikimedia\.org|clevelandart\.org|pixabay\.com)\//,
        );
      }
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
      if (link.target === 'PRODUCT') expect(link.key, link.key).toMatch(TRACE_CODE);
      if (link.target === 'NEWS') expect(newsKeys.has(link.key), link.key).toBe(true);
      const slot = `${link.target}|${link.key}|${link.role}|${link.position}`;
      expect(slots.has(slot), slot).toBe(false);
      slots.add(slot);
    }
  });

  it('news covers are real photos that match the article; the rest keep the illustration (GH#181)', () => {
    const covers = new Map(
      DEMO_PHOTO_LINKS.filter((l) => l.target === 'NEWS' && l.role === 'COVER').map((l) => [
        l.key,
        l.photo,
      ]),
    );
    expect(Object.fromEntries(covers)).toEqual({
      'h7-class': 'ban-xoay-xuong',
      'village-clay-month': 'news-dat-set',
      'h0-blue-glaze': 'binh-hoa-lam',
      'h1-crackle': 'ln-hu-men-ngoc',
      'h3-lotus': 'pp-mf52jtdn',
      'h4-vase': 'khuon-binh-lon',
      'h6-altar': 'pp-a2sbgf7h',
      'h8-white-plate': 'pp-e8uzvyg4',
      'h12-wine-jar': 'pp-bu4ymz85',
      // GH#197: Commons photos of Bát Tràng for the stories GH#181 left without a cover.
      'village-cooperative': 'news-dong-hang',
      'village-trace': 'news-got-bat',
      'village-kiln-safety': 'news-trong-lo',
      'village-spring-fair': 'news-dinh-tet',
      'h0-open-kiln': 'news-khach-tham',
      'h2-logo-cup': 'news-coc-in-hinh',
      'h2-batch-code': 'news-lo-binh-moc',
      'h5-teaset': 'news-am-chen',
    });
    // Only photos credited to Commons, museum open access or Pixabay under CC0/PD/CC BY(-SA) are used.
    for (const photo of covers.values()) {
      const credit = DEMO_PHOTOS.find((p) => p.id === photo)?.credit;
      expect(credit?.license, photo).toMatch(/^(CC0|CC BY|CC BY-SA|Public domain|Pixabay)/i);
      expect(credit?.sourceUrl, photo).toMatch(/^https:\/\//);
    }
    // News about one household never claims the photo shows that household's own piece.
    for (const link of DEMO_PHOTO_LINKS.filter((l) => l.target === 'NEWS' && /^h\d/.test(l.key))) {
      expect(`${link.alt} ${link.altEn}`, link.key).not.toMatch(/\{|của hộ|household's/i);
    }
  });

  it('chỉ sản phẩm có ảnh đúng món đồ mới có ảnh bìa, mỗi sản phẩm một ảnh, mỗi ảnh một sản phẩm', () => {
    const covered = DEMO_PHOTO_LINKS.filter((l) => l.target === 'PRODUCT' && l.role === 'COVER');
    const keys = covered.map((l) => l.key);
    expect(new Set(keys).size, 'one cover per product').toBe(keys.length);
    expect(new Set(covered.map((l) => l.photo)).size, 'one product per photo').toBe(covered.length);
    expect(DEMO_PHOTO_LINKS.filter((l) => l.target === 'PRODUCT')).toHaveLength(covered.length);
    expect(covered.find((l) => l.key === 'BT7K2QXM')?.photo).toBe('binh-men-lam-xam');
    expect(covered.find((l) => l.key === '84PZKVJU')?.photo).toBe('ong-gom-lam-may');
    const own = covered.filter((l) => l.photo.startsWith('pp-'));
    expect(own).toHaveLength(PRODUCT_PHOTO_COUNT);
    // The 83g.48 photos use a lowercase trace code in the id, the 83g.52 ones keep the original uppercase.
    for (const link of own) {
      expect(link.photo.toLowerCase(), link.key).toBe(`pp-${link.key.toLowerCase()}`);
    }
    expect(new Set(keys)).toEqual(
      new Set([...EARLIER_COVERED_TRACE_CODES, ...own.map((l) => l.key)]),
    );
    // Product photos need not come from Bát Tràng, so their descriptions must not claim it.
    for (const link of own) {
      expect(`${link.alt} ${link.altEn}`, link.key).not.toMatch(/b[aá]t\s*tr[aà]ng/i);
    }
    for (const code of NO_COVER_DEMO_PRODUCTS) expect(keys.includes(code), code).toBe(false);
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
