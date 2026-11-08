import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MikroORM } from '@mikro-orm/core';
import {
  DEMO_DOCUMENT_OWNER_ID,
  DEMO_PHOTO_OWNER_ID,
  DEMO_PHOTOS,
  DEMO_VERIFICATION_DOCS,
  demoDocumentAssetId,
  demoPhotoAssetId,
  MediaAsset,
  type MediaCredit,
  MediaLink,
  RETIRED_DEMO_PHOTO_IDS,
} from '@vcraft/database';
import type { ObjectStorage } from '@vcraft/storage';
import { processMediaAsset } from '../processors/media/process-media';

export interface PublishDemoMediaOptions {
  orm: MikroORM;
  storage: ObjectStorage;
  /** Thư mục ảnh minh hoạ `<id>-<width>.webp` (apps/web/public/images/demo). */
  imagesDir: string;
  /** Thư mục giấy tờ mẫu `<id>.png` (scripts/demo/photos/specimen-docs). */
  specimenDir: string;
  /** Làm lại cả những tệp đã READY với cùng nội dung. */
  force?: boolean;
  /** Only count what would be done: nothing is uploaded or written. */
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface PublishDemoMediaSummary {
  photosUploaded: number;
  photosSkipped: number;
  /** Photos that were up to date but whose description or credit changed in the manifest. */
  photosMetadataUpdated: number;
  documentsUploaded: number;
  documentsSkipped: number;
}

/** Field by field: a JSON column does not keep key order, so comparing the serialised text would always differ. */
const sameCredit = (a: MediaCredit | null | undefined, b: MediaCredit): boolean =>
  !!a &&
  a.title === b.title &&
  a.author === b.author &&
  a.license === b.license &&
  a.licenseUrl === b.licenseUrl &&
  a.sourceUrl === b.sourceUrl;

const sha256Of = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/**
 * Tải ảnh minh hoạ và giấy tờ mẫu lên object storage qua ĐÚNG đường của API: bản gốc vào bucket riêng tư
 * (`originals/<chủ>/<id>`), dòng `media_asset` `PROCESSING`, rồi `processMediaAsset` của worker xóa metadata,
 * sinh biến thể AVIF/WebP vào bucket công khai và đặt `READY`. Giấy tờ (mục đích `CERTIFICATE`) chỉ nằm ở bucket
 * riêng tư, không có biến thể.
 *
 * Chạy lại được: id tệp là UUID v5 theo tên ảnh, key bản gốc suy từ id, key biến thể suy từ nội dung nên cùng đầu vào
 * cho cùng đối tượng trong bucket. `demo:reset` xóa `media_asset` nhưng không động tới bucket; chạy lại hàm này dựng
 * lại các dòng đó (ghi đè đúng các key cũ) trước khi `linkDemoMedia` nối chúng vào seed.
 */
export async function publishDemoMedia(
  options: PublishDemoMediaOptions,
): Promise<PublishDemoMediaSummary> {
  const log = options.log ?? (() => undefined);
  const summary: PublishDemoMediaSummary = {
    photosUploaded: 0,
    photosSkipped: 0,
    photosMetadataUpdated: 0,
    documentsUploaded: 0,
    documentsSkipped: 0,
  };

  for (const photo of DEMO_PHOTOS) {
    // Bản rộng nhất làm "ảnh gốc": đã cắt đúng tỉ lệ khung và đã xóa metadata ở bước chuẩn bị ảnh (scripts/demo/photos).
    const width = Math.max(...photo.widths);
    const bytes = new Uint8Array(
      await readFile(join(options.imagesDir, `${photo.id}-${width}.webp`)),
    );
    const sha256 = sha256Of(bytes);
    const id = demoPhotoAssetId(photo.id);

    const em = options.orm.em.fork();
    const existing = await em.findOne(MediaAsset, id);
    if (
      !options.force &&
      existing?.status === 'READY' &&
      existing.sha256 === sha256 &&
      existing.variants.length > 0
    ) {
      summary.photosSkipped++;
      // Same bytes, but the manifest may carry a corrected description or credit.
      if (existing.altText !== photo.alt || !sameCredit(existing.credit, photo.credit)) {
        summary.photosMetadataUpdated++;
        if (!options.dryRun) {
          existing.altText = photo.alt;
          existing.credit = photo.credit;
          await em.flush();
          log(`ảnh ${photo.id}: cập nhật mô tả/ghi công`);
        }
      }
      continue;
    }
    if (options.dryRun) {
      summary.photosUploaded++;
      log(`ảnh ${photo.id}: sẽ tải lên (dry run)`);
      continue;
    }

    const asset =
      existing ??
      em.create(MediaAsset, {
        id,
        ownerId: DEMO_PHOTO_OWNER_ID,
        purpose: 'PRODUCT',
        visibility: 'PUBLIC',
        status: 'PROCESSING',
        mimeType: 'image/webp',
        sizeBytes: bytes.byteLength,
        sha256,
        originalKey: `originals/${DEMO_PHOTO_OWNER_ID}/${id}`,
      });
    asset.status = 'PROCESSING';
    asset.mimeType = 'image/webp';
    asset.sizeBytes = bytes.byteLength;
    asset.sha256 = sha256;
    asset.failureReason = null;
    asset.variants = [];
    asset.altText = photo.alt;
    asset.credit = photo.credit;
    await options.storage.put({
      bucket: 'private',
      key: asset.originalKey,
      body: bytes,
      contentType: 'image/webp',
    });
    await em.flush();

    await processMediaAsset({ orm: options.orm, storage: options.storage }, id);
    const done = await options.orm.em.fork().findOne(MediaAsset, id);
    if (done?.status !== 'READY') {
      throw new Error(`Ảnh ${photo.id} không xử lý được: ${done?.failureReason ?? done?.status}`);
    }
    summary.photosUploaded++;
    log(`ảnh ${photo.id}: ${done.variants.length} biến thể`);
  }

  for (const doc of DEMO_VERIFICATION_DOCS) {
    const bytes = new Uint8Array(await readFile(join(options.specimenDir, `${doc.id}.png`)));
    const sha256 = sha256Of(bytes);
    const id = demoDocumentAssetId(doc.id);
    const em = options.orm.em.fork();
    const existingDoc = await em.findOne(MediaAsset, id);
    if (
      !options.force &&
      existingDoc?.status === 'READY' &&
      existingDoc.sha256 === sha256 &&
      existingDoc.altText === doc.altText
    ) {
      // Same bytes and description: nothing to write (keeps a second run at zero changes).
      summary.documentsSkipped++;
      continue;
    }
    if (options.dryRun) {
      summary.documentsUploaded++;
      continue;
    }
    const asset =
      existingDoc ??
      em.create(MediaAsset, {
        id,
        ownerId: DEMO_DOCUMENT_OWNER_ID,
        purpose: 'CERTIFICATE',
        visibility: 'PRIVATE',
        status: 'READY',
        mimeType: 'image/png',
        sizeBytes: bytes.byteLength,
        sha256,
        originalKey: `originals/${DEMO_DOCUMENT_OWNER_ID}/${id}`,
      });
    asset.status = 'READY';
    asset.mimeType = 'image/png';
    asset.sizeBytes = bytes.byteLength;
    asset.sha256 = sha256;
    asset.altText = doc.altText;
    asset.variants = [];
    await options.storage.put({
      bucket: 'private',
      key: asset.originalKey,
      body: bytes,
      contentType: 'image/png',
    });
    await em.flush();
    summary.documentsUploaded++;
    log(`giấy tờ mẫu ${doc.id}: bucket riêng tư`);
  }
  return summary;
}

/** Kiểm các tệp trong bucket đúng như dòng `media_asset` mô tả (đọc lại thật, không chỉ tin CSDL). */
export async function checkDemoMediaObjects(
  orm: MikroORM,
  storage: ObjectStorage,
): Promise<string[]> {
  const problems: string[] = [];
  const em = orm.em.fork();
  const ids = [
    ...DEMO_PHOTOS.map((p) => demoPhotoAssetId(p.id)),
    ...DEMO_VERIFICATION_DOCS.map((d) => demoDocumentAssetId(d.id)),
  ];
  const assets = await em.find(MediaAsset, { id: { $in: ids } });
  if (assets.length !== ids.length)
    problems.push(`thiếu ${ids.length - assets.length} dòng media_asset`);
  for (const asset of assets) {
    try {
      const original = await storage.get('private', asset.originalKey);
      if (sha256Of(original) !== asset.sha256) problems.push(`${asset.originalKey}: sai nội dung`);
      for (const variant of asset.variants) {
        const bytes = await storage.get('public', variant.key);
        if (bytes.byteLength !== variant.bytes) problems.push(`${variant.key}: sai kích thước`);
      }
    } catch (error) {
      problems.push(
        `${asset.originalKey}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return problems;
}

export interface PruneSummary {
  assetsDeleted: number;
  linksDeleted: number;
  objectsDeleted: number;
  /** Assets whose objects could not all be removed from storage (the rows are kept for a retry). */
  failed: string[];
}

/**
 * Removes the photos that earlier versions published and the manifest has retired
 * (`RETIRED_DEMO_PHOTO_IDS`): their `media_link` rows, `media_asset` rows and every storage object (private
 * original and public variants). Ids are derived from the photo id, so a user's own uploads are never touched.
 * Idempotent: once they are gone it finds nothing. Run it after `linkDemoMedia` so nothing points at them.
 */
export async function pruneRetiredDemoMedia(options: {
  orm: MikroORM;
  storage: ObjectStorage;
  dryRun?: boolean;
  log?: (message: string) => void;
}): Promise<PruneSummary> {
  const log = options.log ?? (() => undefined);
  const summary: PruneSummary = {
    assetsDeleted: 0,
    linksDeleted: 0,
    objectsDeleted: 0,
    failed: [],
  };
  const ids = RETIRED_DEMO_PHOTO_IDS.map(demoPhotoAssetId);
  const em = options.orm.em.fork();
  const assets = await em.find(MediaAsset, { id: { $in: ids } });
  for (const asset of assets) {
    const links = await em.find(MediaLink, { media: asset });
    const keys = [
      { bucket: 'private' as const, key: asset.originalKey },
      ...asset.variants.map((v) => ({ bucket: 'public' as const, key: v.key })),
    ];
    log(`ảnh đã gỡ ${asset.id}: ${links.length} liên kết, ${keys.length} đối tượng lưu trữ`);
    if (options.dryRun) {
      summary.assetsDeleted++;
      summary.linksDeleted += links.length;
      summary.objectsDeleted += keys.length;
      continue;
    }
    try {
      for (const k of keys) await options.storage.delete(k.bucket, k.key);
    } catch (error) {
      summary.failed.push(`${asset.id}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    for (const link of links) em.remove(link);
    em.remove(asset);
    await em.flush();
    summary.assetsDeleted++;
    summary.linksDeleted += links.length;
    summary.objectsDeleted += keys.length;
  }
  return summary;
}
