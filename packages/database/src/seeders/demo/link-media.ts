import type { EntityManager } from '@mikro-orm/core';
import { type ChainContent, sealChain } from '@vcraft/domain';
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
import {
  DEMO_PHOTO_LINKS,
  DEMO_PHOTOS,
  NO_COVER_DEMO_PRODUCTS,
  RETIRED_DEMO_PHOTO_IDS,
} from './photo-manifest.js';
import { demoEntityId } from './seed-demo.js';
import { DEMO_VERIFICATION_DOCS } from './verification-docs.js';

/** Id xác định của tệp ảnh minh hoạ (UUID v5): chạy lại, hoặc reset rồi chạy lại, vẫn ra cùng id và cùng key trong bucket. */
export const demoPhotoAssetId = (photoId: string) => demoEntityId('media-photo', photoId);
export const demoDocumentAssetId = (docId: string) => demoEntityId('media-doc', docId);

/** Chủ tệp: ảnh công khai thuộc Ban quản lý; giấy tờ thuộc người đại diện hộ chờ duyệt (đúng quy tắc đọc của `MediaService`). */
export const DEMO_PHOTO_OWNER_ID = DEMO_ACCOUNTS.admin.id;
export const DEMO_DOCUMENT_OWNER_ID = DEMO_ACCOUNTS.pending.id;

export interface LinkDemoMediaSummary {
  photoAssets: number;
  documentAssets: number;
  /** Desired `media_link` rows (photos and documents). */
  links: number;
  linksCreated: number;
  linksUpdated: number;
  linksDeleted: number;
  /** Product/household cover columns rewritten. */
  coversChanged: number;
  /** Journal entries whose images were cleared and hash re-sealed. */
  journalEntriesChanged: number;
  /** Everything above that changed a row; 0 means the data already matches the manifest. */
  changes: number;
}

/** Chiều rộng biến thể dùng làm ảnh bìa sản phẩm/hộ mà API công khai trả (`coverUrl`). */
const COVER_IMAGE_WIDTH = 1280;
const DEFAULT_DISPLAY_WIDTH = 640;

/** Biến thể WebP gần `width` px nhất (mặc định 640) của tệp; `undefined` khi tệp chưa có biến thể. */
export function pickDisplayVariant(
  variants: readonly MediaVariant[],
  width: number = DEFAULT_DISPLAY_WIDTH,
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

export type LinkStep = 'links' | 'covers' | 'journal';

interface WantedLink {
  mediaId: string;
  targetType: 'PRODUCT' | 'HOUSEHOLD' | 'NEWS';
  targetId: string;
  role: 'COVER' | 'PORTRAIT' | 'BANNER' | 'GALLERY' | 'DOCUMENT';
  position: number;
  altText: string;
  altEn: string;
  caption: string | null;
}

const slotOf = (l: { targetType: string; targetId: string; role: string; position: number }) =>
  `${l.targetType}|${l.targetId}|${l.role}|${l.position}`;

/** Sentinel used to roll the transaction back after a dry run. */
class DryRunDone extends Error {
  constructor(readonly summary: LinkDemoMediaSummary) {
    super('dry run');
  }
}

/**
 * Gắn các tệp đã tải lên (xem `pnpm demo:media`) vào dữ liệu mẫu, chạy lại được bất cứ lúc nào, kể cả ngay sau `demo:reset`.
 * Chỉ ghi những dòng khác với bảng ánh xạ (`photo-manifest.ts`), nên chạy lần hai cho `changes: 0`:
 * - `media_link`: ảnh bìa sản phẩm, ảnh thẻ/bìa/thư viện của hộ, ảnh bìa tin, giấy tờ của hộ chờ duyệt; mỗi liên kết có mô tả
 *   tiếng Việt (`alt_text`) và tiếng Anh (`alt_en`). Liên kết của tệp demo không còn trong bảng ánh xạ bị xóa.
 * - `product.cover_url/cover_alt/cover_alt_en` và `household.cover_url` theo liên kết; sản phẩm demo không còn ảnh bìa
 *   (`NO_COVER_DEMO_PRODUCTS`) được gỡ ảnh bìa để giao diện dùng hình minh hoạ.
 * - `JournalEntry.images`: ảnh minh hoạ công đoạn KHÔNG còn gắn vào nhật ký (một ảnh chung không phải ảnh của món
 *   đồ); mốc nào còn ảnh thì được xóa, chuỗi băm của sản phẩm đó được niêm phong lại (`sealChain`) và vẫn qua `verifyChain`.
 * `publicUrl` đổi key biến thể thành URL công khai (cùng cổng lưu trữ mà API dùng). `dryRun` tính tóm tắt rồi hoàn tác.
 */
export async function linkDemoMedia(
  em: EntityManager,
  options: {
    publicUrl: (key: string) => string;
    dryRun?: boolean;
    /** Run only some parts (a staged rollout on shared data): default is all three. */
    steps?: ReadonlySet<LinkStep>;
    /** With the `journal` step: only these products (by trace code), for a first small apply. */
    journalProducts?: readonly string[];
  },
): Promise<LinkDemoMediaSummary> {
  const runs = (step: LinkStep) => options.steps === undefined || options.steps.has(step);
  try {
    return await em.transactional(async (tx) => {
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
      const resolveTarget = await loadTargetResolver(tx);

      const wanted: WantedLink[] = [];
      for (const link of DEMO_PHOTO_LINKS) {
        wanted.push({
          mediaId: (photoAssets.get(link.photo) as MediaAsset).id,
          targetType: link.target,
          targetId: resolveTarget(link.target, link.key),
          role: link.role,
          position: link.position,
          altText: link.alt,
          altEn: link.altEn,
          caption: link.caption ?? null,
        });
      }
      for (const [position, doc] of DEMO_VERIFICATION_DOCS.entries()) {
        wanted.push({
          mediaId: (docAssets.get(doc.id) as MediaAsset).id,
          targetType: 'HOUSEHOLD',
          targetId: DEMO_HOUSEHOLD_IDS.pending,
          role: 'DOCUMENT',
          position,
          altText: doc.altText,
          altEn: doc.altTextEn,
          caption: doc.caption,
        });
      }

      // --- media_link: diff against what is there, per slot -------------------------------------------------
      // Links of retired photos count too: their slots are reused or freed here, before the files are pruned.
      const demoAssetIds = [
        ...[...photoAssets.values(), ...docAssets.values()].map((a) => a.id),
        ...RETIRED_DEMO_PHOTO_IDS.map(demoPhotoAssetId),
      ];
      const existing = runs('links')
        ? await tx.find(MediaLink, { media: { $in: demoAssetIds } })
        : [];
      const bySlot = new Map(existing.map((l) => [slotOf(l), l]));
      const wantedSlots = new Set(wanted.map(slotOf));
      let linksCreated = 0;
      let linksUpdated = 0;
      let linksDeleted = 0;
      for (const link of existing) {
        // `existing` is empty unless the links step runs.
        if (!wantedSlots.has(slotOf(link))) {
          tx.remove(link);
          linksDeleted++;
        }
      }
      for (const want of runs('links') ? wanted : []) {
        const have = bySlot.get(slotOf(want));
        if (!have) {
          // A slot may hold another file that is not a demo asset (never happens for demo targets); skip that case.
          tx.create(MediaLink, {
            media: tx.getReference(MediaAsset, want.mediaId),
            targetType: want.targetType,
            targetId: want.targetId,
            role: want.role,
            position: want.position,
            altText: want.altText,
            altEn: want.altEn,
            caption: want.caption,
          });
          linksCreated++;
          continue;
        }
        if (
          have.media.id !== want.mediaId ||
          (have.altText ?? null) !== want.altText ||
          (have.altEn ?? null) !== want.altEn ||
          (have.caption ?? null) !== want.caption
        ) {
          have.media = tx.getReference(MediaAsset, want.mediaId);
          have.altText = want.altText;
          have.altEn = want.altEn;
          have.caption = want.caption;
          linksUpdated++;
        }
      }
      // Deleting must hit the database before a new row takes a slot freed by that delete (unique slot).
      await tx.flush();

      // --- covers -------------------------------------------------------------------------------------------
      // API công khai (GH#47) trả ảnh bìa từ `coverUrl`/`coverAlt`: trỏ chúng về bản 1280px trong bucket.
      let coversChanged = 0;
      for (const link of runs('covers') ? DEMO_PHOTO_LINKS : []) {
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
          const product = await tx.findOneOrFail(Product, { traceCode: link.key });
          if (
            product.coverUrl !== coverUrl ||
            product.coverAlt !== link.alt ||
            product.coverAltEn !== link.altEn
          ) {
            product.coverUrl = coverUrl;
            product.coverAlt = link.alt;
            product.coverAltEn = link.altEn;
            coversChanged++;
          }
        } else {
          const household = await tx.findOneOrFail(Household, { slug: link.key });
          if (household.coverUrl !== coverUrl) {
            household.coverUrl = coverUrl;
            coversChanged++;
          }
        }
      }
      // Demo products that no longer have a matching photo fall back to a preset illustration.
      for (const code of runs('covers') ? NO_COVER_DEMO_PRODUCTS : []) {
        const product = await tx.findOne(Product, { traceCode: code });
        if (product && (product.coverUrl || product.coverAlt || product.coverAltEn)) {
          product.coverUrl = null;
          product.coverAlt = null;
          product.coverAltEn = null;
          coversChanged++;
        }
      }

      // --- journal: no generic stage photos on a product's entries; re-seal the chain when any image goes ----
      const entries = runs('journal')
        ? await tx.find(JournalEntry, {}, { populate: ['supersedes'], orderBy: { seq: 'asc' } })
        : [];
      const byProduct = new Map<string, JournalEntry[]>();
      for (const entry of entries) {
        const list = byProduct.get(entry.product.id) ?? [];
        list.push(entry);
        byProduct.set(entry.product.id, list);
      }
      let journalEntriesChanged = 0;
      const onlyProducts = options.journalProducts
        ? new Set(
            (await tx.find(Product, { traceCode: { $in: [...options.journalProducts] } })).map(
              (p) => p.id,
            ),
          )
        : undefined;
      for (const [productId, list] of byProduct) {
        if (onlyProducts && !onlyProducts.has(productId)) continue;
        const contents: Array<ChainContent> = list.map((entry) => ({
          stage: entry.stage,
          at: entry.declaredDate,
          note: entry.note,
          mediaChecksums: [],
          supersedesSeq: entry.supersedes?.seq,
          skipReason: entry.skipReason ?? undefined,
        }));
        const sealed = await sealChain(productId, contents);
        const needsWork = list.some((entry, index) => {
          const next = sealed[index] as { prevHash: string; hash: string };
          return (
            entry.images.length > 0 || entry.prevHash !== next.prevHash || entry.hash !== next.hash
          );
        });
        if (!needsWork) continue;
        for (const [index, entry] of list.entries()) {
          const next = sealed[index] as { prevHash: string; hash: string };
          if (
            entry.images.length === 0 &&
            entry.prevHash === next.prevHash &&
            entry.hash === next.hash
          )
            continue;
          entry.images = [];
          entry.prevHash = next.prevHash;
          entry.hash = next.hash;
          journalEntriesChanged++;
        }
      }
      await tx.flush();

      const summary: LinkDemoMediaSummary = {
        photoAssets: photoAssets.size,
        documentAssets: docAssets.size,
        links: wanted.length,
        linksCreated,
        linksUpdated,
        linksDeleted,
        coversChanged,
        journalEntriesChanged,
        changes: linksCreated + linksUpdated + linksDeleted + coversChanged + journalEntriesChanged,
      };
      if (options.dryRun) throw new DryRunDone(summary);
      return summary;
    });
  } catch (error) {
    if (error instanceof DryRunDone) return error.summary;
    throw error;
  }
}
