import type { MikroORM } from '@mikro-orm/core';
import { MediaAsset } from '@vcraft/database';
import { IMMUTABLE_CACHE_CONTROL, type ObjectStorage } from '@vcraft/storage';
import { convertImage } from './convert-image';

export interface MediaDeps {
  orm: MikroORM;
  storage: ObjectStorage;
}

const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp' } as const;

/**
 * Job `media`: chuyển ảnh công khai thành biến thể trong bucket công khai rồi đặt `READY`.
 * Idempotent: chỉ xử lý tệp còn `PROCESSING`, key biến thể suy ra từ nội dung. Lỗi decode là lỗi
 * vĩnh viễn ⇒ `FAILED`; lỗi lưu trữ/CSDL ném ra để BullMQ thử lại.
 */
export async function processMediaAsset(deps: MediaDeps, assetId: string): Promise<void> {
  const em = deps.orm.em.fork();
  const asset = await em.findOne(MediaAsset, assetId);
  if (asset?.status !== 'PROCESSING' || asset.visibility !== 'PUBLIC') return;

  const original = await deps.storage.get('private', asset.originalKey);
  let converted: Awaited<ReturnType<typeof convertImage>>;
  try {
    converted = await convertImage(original);
  } catch (error) {
    asset.status = 'FAILED';
    asset.failureReason = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    await em.flush();
    return;
  }

  const variants = [];
  for (const variant of converted.variants) {
    const key = `v/${asset.id}/${variant.width}-${variant.hash}.${variant.format}`;
    await deps.storage.put({
      bucket: 'public',
      key,
      body: variant.bytes,
      contentType: CONTENT_TYPES[variant.format],
      cacheControl: IMMUTABLE_CACHE_CONTROL,
    });
    variants.push({
      format: variant.format,
      width: variant.width,
      height: variant.height,
      key,
      bytes: variant.bytes.byteLength,
    });
  }
  asset.width = converted.width;
  asset.height = converted.height;
  asset.thumbhash = converted.thumbhash;
  asset.dominantColor = converted.dominantColor;
  asset.variants = variants;
  asset.status = 'READY';
  await em.flush();
}
