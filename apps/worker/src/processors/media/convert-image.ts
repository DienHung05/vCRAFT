import { createHash } from 'node:crypto';
import { MEDIA_MAX_PIXELS, planVariantWidths } from '@vcraft/domain';
import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';

export interface ConvertedVariant {
  format: 'avif' | 'webp';
  width: number;
  height: number;
  /** 16 ký tự đầu SHA-256 của nội dung: đưa vào key để cache vĩnh viễn an toàn. */
  hash: string;
  bytes: Uint8Array;
}

export interface ConvertedImage {
  width: number;
  height: number;
  thumbhash: string;
  dominantColor: string;
  variants: ConvertedVariant[];
}

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/**
 * FR-MEDIA-03: xoay theo EXIF, bỏ toàn bộ metadata (EXIF/GPS/ICC: sharp chỉ giữ khi gọi
 * `withMetadata`), sinh AVIF + WebP theo {@link planVariantWidths}, kèm ThumbHash và màu chủ đạo.
 * Ném lỗi khi không decode được hoặc ảnh quá nhiều điểm ảnh (`limitInputPixels`).
 */
export async function convertImage(original: Uint8Array): Promise<ConvertedImage> {
  const base = sharp(original, { limitInputPixels: MEDIA_MAX_PIXELS, failOn: 'error' }).rotate();
  const { data, info } = await base.clone().toBuffer({ resolveWithObject: true });
  const oriented = sharp(data);
  const { width, height } = info;

  const variants: ConvertedVariant[] = [];
  for (const target of planVariantWidths(width)) {
    const resized = oriented.clone().resize({ width: target, withoutEnlargement: true });
    for (const format of ['avif', 'webp'] as const) {
      const encoded =
        format === 'avif'
          ? resized.clone().avif({ quality: 50, effort: 4 })
          : resized.clone().webp({ quality: 75 });
      const out = await encoded.toBuffer({ resolveWithObject: true });
      variants.push({
        format,
        width: out.info.width,
        height: out.info.height,
        hash: createHash('sha256').update(out.data).digest('hex').slice(0, 16),
        bytes: new Uint8Array(out.data),
      });
    }
  }

  // ThumbHash yêu cầu cạnh ≤ 100px.
  const thumb = await oriented
    .clone()
    .resize({ width: 100, height: 100, fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thumbhash = Buffer.from(
    rgbaToThumbHash(thumb.info.width, thumb.info.height, thumb.data),
  ).toString('base64');
  const { dominant } = await oriented.clone().stats();

  return {
    width,
    height,
    thumbhash,
    dominantColor: `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`,
    variants,
  };
}
