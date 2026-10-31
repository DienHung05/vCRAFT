import type { EntityManager } from '@mikro-orm/core';
import { type ChainContent, JOURNAL_STAGES, sealChain } from '@vcraft/domain';
import {
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
  type MediaVariant,
  News,
  Product,
} from '../../entities/index.js';
import { DEMO_ACCOUNTS, DEMO_HOUSEHOLD_IDS } from './accounts.js';
import { DEMO_PHOTO_LINKS, DEMO_PHOTOS, DEMO_STAGE_PHOTOS } from './photo-manifest.js';
import { demoEntityId } from './seed-demo.js';
import { DEMO_VERIFICATION_DOCS } from './verification-docs.js';

/** Id xác định của tệp ảnh minh hoạ (UUID v5): chạy lại, hoặc reset rồi chạy lại, vẫn ra cùng id và cùng key trong bucket. */
export const demoPhotoAssetId = (photoId: string) => demoEntityId('media-photo', photoId);
export const demoDocumentAssetId = (docId: string) => demoEntityId('media-doc', docId);

/** Chủ tệp: ảnh công khai thuộc Ban quản lý; giấy tờ thuộc người đại diện hộ chờ duyệt (đúng quy tắc đọc của `MediaService`). */
export const DEMO_PHOTO_OWNER_ID = DEMO_ACCOUNTS.admin.id;
export const DEMO_DOCUMENT_OWNER_ID = DEMO_ACCOUNTS.pending.id;

/** Chiều rộng biến thể dùng làm URL hiển thị trong `JournalEntry.images`. */
const JOURNAL_IMAGE_WIDTH = 640;

export interface LinkDemoMediaSummary {
  photoAssets: number;
  documentAssets: number;
  links: number;
  journalEntriesWithImage: number;
}

/** Chiều rộng biến thể dùng cho ảnh bìa sản phẩm/hộ mà API công khai trả (`coverUrl`). */
const COVER_IMAGE_WIDTH = 1280;

/** Biến thể WebP gần `width` px nhất (mặc định 640) của tệp; `undefined` khi tệp chưa có biến thể. */
export function pickDisplayVariant(
  variants: readonly MediaVariant[],
  width: number = JOURNAL_IMAGE_WIDTH,
): MediaVariant | undefined {
  return variants
    .filter((v) => v.format === 'webp')
    .sort((a, b) => {
      const da = Math.abs(a.width - width);
      const db = Math.abs(b.width - width);
      return da - db || a.width - b.width;
    })[0];
}

/** Tìm id của hộ (theo slug), sản phẩm (theo mã truy xuất) và tin (theo khóa seed) mà bảng ánh xạ ảnh nhắc tới. */
export async function loadTargetResolver(
  em: EntityManager,
): Promise<(target: string, key: string) => string> {
  const households = new Map(
    (await em.find(Household, {}, { fields: ['id', 'slug'] })).map((h) => [h.slug, h.id]),
  );
  const products = new Map(
    (await em.find(Product, {}, { fields: ['id', 'traceCode'] })).map((p) => [p.traceCode, p.id]),
  );
  const newsIds = new Set((await em.find(News, {}, { fields: ['id'] })).map((n) => n.id));
  return (target, key) => {
    let id: string | undefined;
    if (target === 'HOUSEHOLD') id = households.get(key);
    else if (target === 'PRODUCT') id = products.get(key);
    else {
      const candidate = demoEntityId('news', key);
      id = newsIds.has(candidate) ? candidate : undefined;
    }
    if (!id) {
      throw new Error(
        `Không tìm thấy ${target} "${key}" để gắn ảnh; chạy lại \`pnpm demo:reset\` rồi \`pnpm demo:media\`.`,
      );
    }
    return id;
  };
}

async function loadAssets(em: EntityManager, ids: Map<string, string>, what: string) {
  const found = await em.find(MediaAsset, { id: { $in: [...ids.values()] } });
  const byId = new Map(found.map((a) => [a.id, a]));
  const out = new Map<string, MediaAsset>();
  for (const [key, id] of ids) {
    const asset = byId.get(id);
    if (asset?.status !== 'READY') {
      throw new Error(
        `Chưa có ${what} "${key}" ở trạng thái READY; chạy \`pnpm demo:media\` trước.`,
      );
    }
    out.set(key, asset);
  }
  return out;
}

/**
 * Gắn các tệp đã tải lên (xem `pnpm demo:media`) vào dữ liệu mẫu, chạy lại được bất cứ lúc nào, kể cả ngay sau `demo:reset`:
 * - `media_link`: ảnh bìa sản phẩm, ảnh thẻ/bìa/thư viện của hộ, ảnh bìa tin, giấy tờ của hộ chờ duyệt. Xóa rồi tạo lại toàn
 *   bộ liên kết của các tệp demo nên không bao giờ trùng.
 * - `JournalEntry.images`: mỗi mốc nhận ảnh minh hoạ của công đoạn đó. Ảnh nằm trong chuỗi băm (`mediaChecksums`) nên
 *   chuỗi của từng sản phẩm được niêm phong lại (`sealChain`) và vẫn qua `verifyChain`.
 * `publicUrl` đổi key biến thể thành URL công khai (cùng cổng lưu trữ mà API dùng).
 */
export async function linkDemoMedia(
  em: EntityManager,
  options: { publicUrl: (key: string) => string },
): Promise<LinkDemoMediaSummary> {
  return em.transactional(async (tx) => {
    const photoAssets = await loadAssets(
      tx,
      new Map(DEMO_PHOTOS.map((p) => [p.id, demoPhotoAssetId(p.id)])),
      'ảnh',
    );
    const docAssets = await loadAssets(
      tx,
      new Map(DEMO_VERIFICATION_DOCS.map((d) => [d.id, demoDocumentAssetId(d.id)])),
      'giấy tờ mẫu',
    );

    const allIds = [...photoAssets.values(), ...docAssets.values()].map((a) => a.id);
    await tx.nativeDelete(MediaLink, { media: { $in: allIds } });

    const resolveTarget = await loadTargetResolver(tx);

    let links = 0;
    for (const link of DEMO_PHOTO_LINKS) {
      tx.create(MediaLink, {
        media: photoAssets.get(link.photo) as MediaAsset,
        targetType: link.target,
        targetId: resolveTarget(link.target, link.key),
        role: link.role,
        position: link.position,
        altText: link.alt,
        caption: link.caption ?? null,
      });
      links++;
    }
    // API công khai (GH#47) trả ảnh bìa từ `coverUrl`/`coverAlt`: trỏ chúng về bản 1280px trong bucket.
    for (const link of DEMO_PHOTO_LINKS) {
      const isProductCover = link.target === 'PRODUCT' && link.role === 'COVER';
      const isHouseholdCover = link.target === 'HOUSEHOLD' && link.role === 'BANNER';
      if (!isProductCover && !isHouseholdCover) continue;
      const variant = pickDisplayVariant(
        (photoAssets.get(link.photo) as MediaAsset).variants,
        COVER_IMAGE_WIDTH,
      );
      if (!variant) throw new Error(`Ảnh bìa "${link.photo}" chưa có biến thể WebP`);
      const coverUrl = options.publicUrl(variant.key);
      if (isProductCover) {
        await tx.nativeUpdate(Product, { traceCode: link.key }, { coverUrl, coverAlt: link.alt });
      } else {
        await tx.nativeUpdate(Household, { slug: link.key }, { coverUrl });
      }
    }
    for (const [position, doc] of DEMO_VERIFICATION_DOCS.entries()) {
      tx.create(MediaLink, {
        media: docAssets.get(doc.id) as MediaAsset,
        targetType: 'HOUSEHOLD',
        targetId: DEMO_HOUSEHOLD_IDS.pending,
        role: 'DOCUMENT',
        position,
        altText: doc.altText,
        caption: doc.caption,
      });
      links++;
    }

    // Ảnh minh hoạ cho từng mốc nhật ký, rồi niêm phong lại từng chuỗi.
    const stageImage = new Map<string, { url: string; sha256: string }>();
    for (const stage of JOURNAL_STAGES) {
      const photoId = DEMO_STAGE_PHOTOS[stage];
      const asset = photoAssets.get(photoId);
      const variant = asset && pickDisplayVariant(asset.variants);
      if (!asset || !variant) throw new Error(`Ảnh công đoạn "${stage}" chưa có biến thể WebP`);
      stageImage.set(stage, { url: options.publicUrl(variant.key), sha256: asset.sha256 });
    }
    const entries = await tx.find(
      JournalEntry,
      {},
      { populate: ['supersedes'], orderBy: { seq: 'asc' } },
    );
    const byProduct = new Map<string, JournalEntry[]>();
    for (const entry of entries) {
      const list = byProduct.get(entry.product.id) ?? [];
      list.push(entry);
      byProduct.set(entry.product.id, list);
    }
    let journalEntriesWithImage = 0;
    for (const [productId, list] of byProduct) {
      const contents: Array<ChainContent> = list.map((entry) => {
        const image = stageImage.get(entry.stage);
        if (!image) throw new Error(`Công đoạn "${entry.stage}" không có ảnh minh hoạ`);
        return {
          stage: entry.stage,
          at: entry.declaredDate,
          note: entry.note,
          mediaChecksums: [image.sha256],
          supersedesSeq: entry.supersedes?.seq,
          skipReason: entry.skipReason ?? undefined,
        };
      });
      const sealed = await sealChain(productId, contents);
      for (const [index, entry] of list.entries()) {
        const image = stageImage.get(entry.stage) as { url: string; sha256: string };
        entry.images = [{ url: image.url, sha256: image.sha256 }];
        entry.prevHash = (sealed[index] as { prevHash: string }).prevHash;
        entry.hash = (sealed[index] as { hash: string }).hash;
        journalEntriesWithImage++;
      }
    }
    await tx.flush();

    return {
      photoAssets: photoAssets.size,
      documentAssets: docAssets.size,
      links,
      journalEntriesWithImage,
    };
  });
}
