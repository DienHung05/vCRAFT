import type { EntityManager, MikroORM } from '@mikro-orm/core';
import { MediaAsset, type MediaVariant, queueExhibitionChange } from '@vcraft/database';
import { isHeicMime, planVariantWidths } from '@vcraft/domain';
import { IMMUTABLE_CACHE_CONTROL, type ObjectStorage } from '@vcraft/storage';
import { EXHIBITION_TAG } from '@vcraft/utils';
import {
  type ConvertedVariant,
  convertImageInPhases,
  convertMissingVariants,
  type WantedVariant,
} from './convert-image';

export interface MediaDeps {
  orm: MikroORM;
  storage: ObjectStorage;
}

const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp' } as const;

const variantKey = (width: number, format: 'avif' | 'webp') => `${width}.${format}`;

const byWidthThenFormat = (a: MediaVariant, b: MediaVariant) =>
  a.width - b.width || a.format.localeCompare(b.format);

/** Every size and format the current ladder asks for at an image this wide, narrowest first. */
function plannedVariants(originalWidth: number): WantedVariant[] {
  return planVariantWidths(originalWidth).flatMap((width) => [
    { format: 'webp' as const, width },
    { format: 'avif' as const, width },
  ]);
}

/**
 * Ladder entries a `READY` asset does not have yet: a size added to the ladder after it was published
 * (GH#530) or an AVIF phase that failed (GH#345). A legacy row without an intrinsic width can only be
 * planned from the widths it already stores, so it just gets the missing AVIF of those.
 */
export function missingVariants(asset: MediaAsset): WantedVariant[] {
  const have = new Set(asset.variants.map((v) => variantKey(v.width, v.format)));
  if (!asset.width || asset.width <= 0)
    return asset.variants
      .filter((v) => v.format === 'webp')
      .map((v) => ({ format: 'avif' as const, width: v.width }))
      .filter((want) => !have.has(variantKey(want.width, want.format)));
  return plannedVariants(asset.width).filter(
    (want) => !have.has(variantKey(want.width, want.format)),
  );
}

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
 * Fills in the sizes and formats a `READY` asset is missing without touching the ones it has (GH#345,
 * GH#530). A retry after a failed AVIF phase and a size the ladder gained later both land here; the
 * stored WebP/AVIF files are never re-encoded or rewritten, so their immutable keys stay valid.
 */
async function backfillVariants(
  deps: MediaDeps,
  em: EntityManager,
  asset: MediaAsset,
  wanted: readonly WantedVariant[],
): Promise<void> {
  const original = await deps.storage.get('private', asset.originalKey);
  let added: ConvertedVariant[];
  try {
    added = await convertMissingVariants(original, wanted, { heic: isHeicMime(asset.mimeType) });
  } catch {
    // The existing files are already live; leave the asset READY so a later run can try again.
    return;
  }
  if (added.length === 0) return;

  const knownWidths = new Set(asset.variants.map((v) => v.width));
  const stored = await storeVariants(deps, asset, added);
  asset.variants = [...asset.variants, ...stored].sort(byWidthThenFormat);
  // A size no page could offer before changes the srcset a cached public read holds, so the web drops
  // those pages (ADR-0027). An AVIF-only fill of widths already present changes nothing the browser picks.
  if (stored.some((v) => !knownWidths.has(v.width))) queueExhibitionChange(em, [EXHIBITION_TAG]);
  await em.flush();
}

/**
 * Job `media`: chuyển ảnh công khai thành biến thể trong bucket công khai rồi đặt `READY`.
 * Idempotent: chỉ xử lý tệp còn `PROCESSING`, key biến thể suy ra từ nội dung. Lỗi decode là lỗi
 * vĩnh viễn ⇒ `FAILED`; lỗi lưu trữ/CSDL ném ra để BullMQ thử lại.
 *
 * Two phases (GH#252): WebP is fast to encode and is what every page displays, so the asset turns
 * `READY` as soon as the WebP sizes are stored; the AVIF sizes, ten times slower to encode, are added
 * to `variants` afterwards. On a small CPU this cuts the wait from minutes to seconds.
 *
 * A `READY` asset re-run fills only what it lacks (GH#345 for a failed AVIF phase, GH#530 for a size
 * the ladder gained after it was published), so an additive backfill never disturbs a live image.
 */
export async function processMediaAsset(deps: MediaDeps, assetId: string): Promise<void> {
  const em = deps.orm.em.fork();
  const asset = await em.findOne(MediaAsset, assetId);
  if (asset?.visibility !== 'PUBLIC') return;

  if (asset.status === 'READY') {
    const wanted = missingVariants(asset);
    if (wanted.length === 0) return;
    await backfillVariants(deps, em, asset, wanted);
    return;
  }
  if (asset.status !== 'PROCESSING') return;

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
  // A public photo that just became READY may now show on an exhibition page that linked it while it
  // was processing; the same flush records the event, so the web drops its cached pages (ADR-0027).
  queueExhibitionChange(em, [EXHIBITION_TAG]);
  await em.flush();

  const avif = await storeVariants(deps, asset, await converted.encodeAvif());
  asset.variants = [...webp, ...avif].sort(byWidthThenFormat);
  await em.flush();
}

/**
 * Called once BullMQ gave up on a media job (GH#345): a storage or database error exhausted every
 * retry, so the asset would stay `PROCESSING` forever. Marks it `FAILED` with a reason; the API's live
 * stream then announces the change like any other status flip. A `READY` asset (WebP already live,
 * only AVIF missing) is left alone.
 */
export async function failMediaAsset(
  deps: Pick<MediaDeps, 'orm'>,
  assetId: string,
  error: Error,
): Promise<void> {
  const em = deps.orm.em.fork();
  const asset = await em.findOne(MediaAsset, assetId);
  if (asset?.status !== 'PROCESSING') return;
  asset.status = 'FAILED';
  asset.failureReason = error.message.slice(0, 300);
  await em.flush();
}
