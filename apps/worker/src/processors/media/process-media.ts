import type { MikroORM } from '@mikro-orm/core';
import { MediaAsset, type MediaVariant } from '@vcraft/database';
import { isHeicMime } from '@vcraft/domain';
import { IMMUTABLE_CACHE_CONTROL, type ObjectStorage } from '@vcraft/storage';
import { type ConvertedVariant, convertImageInPhases } from './convert-image';

export interface MediaDeps {
  orm: MikroORM;
  storage: ObjectStorage;
}

const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp' } as const;

async function storeVariants(
  deps: MediaDeps,
  asset: MediaAsset,
  converted: readonly ConvertedVariant[],
): Promise<MediaVariant[]> {
  const variants: MediaVariant[] = [];
  for (const variant of converted) {
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
  return variants;
}

/**
 * Job `media`: chuyển ảnh công khai thành biến thể trong bucket công khai rồi đặt `READY`.
 * Idempotent: chỉ xử lý tệp còn `PROCESSING`, key biến thể suy ra từ nội dung. Lỗi decode là lỗi
 * vĩnh viễn ⇒ `FAILED`; lỗi lưu trữ/CSDL ném ra để BullMQ thử lại.
 *
 * Two phases (GH#252): WebP is fast to encode and is what every page displays, so the asset turns
 * `READY` as soon as the WebP sizes are stored; the AVIF sizes, ten times slower to encode, are added
 * to `variants` afterwards. On a small CPU this cuts the wait from minutes to seconds.
 */
export async function processMediaAsset(deps: MediaDeps, assetId: string): Promise<void> {
  const em = deps.orm.em.fork();
  const asset = await em.findOne(MediaAsset, assetId);
  if (asset?.status !== 'PROCESSING' || asset.visibility !== 'PUBLIC') return;

  const original = await deps.storage.get('private', asset.originalKey);
  let converted: Awaited<ReturnType<typeof convertImageInPhases>>;
  try {
    converted = await convertImageInPhases(original, { heic: isHeicMime(asset.mimeType) });
  } catch (error) {
    asset.status = 'FAILED';
    asset.failureReason = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    await em.flush();
    return;
  }

  const webp = await storeVariants(deps, asset, converted.webp);
  asset.width = converted.width;
  asset.height = converted.height;
  asset.thumbhash = converted.thumbhash;
  asset.dominantColor = converted.dominantColor;
  asset.variants = webp;
  asset.status = 'READY';
  await em.flush();

  const avif = await storeVariants(deps, asset, await converted.encodeAvif());
  asset.variants = [...webp, ...avif].sort(
    (a, b) => a.width - b.width || a.format.localeCompare(b.format),
  );
  await em.flush();
}
