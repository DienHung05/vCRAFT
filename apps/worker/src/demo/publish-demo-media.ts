import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MikroORM } from '@mikro-orm/core';
import {
  DEMO_DOCUMENT_OWNER_ID,
  DEMO_PHOTO_OWNER_ID,
  DEMO_PHOTOS,
  DEMO_STAGE_PHOTOS,
  DEMO_VERIFICATION_DOCS,
  demoDocumentAssetId,
  demoPhotoAssetId,
  MediaAsset,
} from '@vcraft/database';
import type { MediaPurpose } from '@vcraft/domain';
import type { ObjectStorage } from '@vcraft/storage';
import { processMediaAsset } from '../processors/media/process-media';

export interface PublishDemoMediaOptions {
  orm: MikroORM;
  storage: ObjectStorage;
  /** Thư mục ảnh minh hoạ `<id>-<width>.webp` (apps/web/public/images/demo). */
  imagesDir: string;
  /** Thư mục giấy tờ mẫu `<id>.png` (scripts/demo-photos/specimen-docs). */
  specimenDir: string;
  /** Làm lại cả những tệp đã READY với cùng nội dung. */
  force?: boolean;
  log?: (message: string) => void;
}

export interface PublishDemoMediaSummary {
  photosUploaded: number;
  photosSkipped: number;
  documentsUploaded: number;
}

const sha256Of = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

/** Ảnh công đoạn thuộc mục đích `JOURNAL`; mọi ảnh công khai khác (sản phẩm, hộ, tin) dùng `PRODUCT`, mục đích công khai còn lại của API. */
const STAGE_PHOTO_IDS = new Set(Object.values(DEMO_STAGE_PHOTOS));
const purposeOf = (photoId: string): MediaPurpose =>
  STAGE_PHOTO_IDS.has(photoId) ? 'JOURNAL' : 'PRODUCT';

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
    documentsUploaded: 0,
  };

  for (const photo of DEMO_PHOTOS) {
    // Bản rộng nhất làm "ảnh gốc": đã cắt đúng tỉ lệ khung và đã xóa metadata ở bước chuẩn bị ảnh (scripts/demo-photos).
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
      continue;
    }

    const asset =
      existing ??
      em.create(MediaAsset, {
        id,
        ownerId: DEMO_PHOTO_OWNER_ID,
        purpose: purposeOf(photo.id),
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
    const asset =
      (await em.findOne(MediaAsset, id)) ??
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
