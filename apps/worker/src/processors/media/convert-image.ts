import { createHash } from 'node:crypto';
import { MEDIA_MAX_PIXELS, planVariantWidths } from '@vcraft/domain';
import decodeHeic from 'heic-decode';
import sharp, { type Sharp } from 'sharp';
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

/**
 * Result of the fast first phase: every WebP size plus the metadata, enough to publish the image.
 * `encodeAvif` runs the slow second phase (AVIF is an order of magnitude slower than WebP to encode).
 */
export interface ConvertedImageInPhases extends Omit<ConvertedImage, 'variants'> {
  webp: ConvertedVariant[];
  encodeAvif: () => Promise<ConvertedVariant[]>;
}

export interface ConvertOptions {
  /** The original is HEIC/HEIF: sharp's prebuilt libvips has no HEVC decoder, so a JS decoder reads it. */
  heic?: boolean;
}

const toHex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

/**
 * Oriented pixels of a HEIC/HEIF photo. libheif applies the file's own rotation (`irot`), so no EXIF
 * rotation is needed. The pixel count is checked from the header first: decoding allocates width x height x 4.
 */
async function decodeHeicPhoto(
  original: Uint8Array,
): Promise<{ image: Sharp; width: number; height: number }> {
  const header = await sharp(original)
    .metadata()
    .catch(() => undefined);
  if (header?.width && header.height && header.width * header.height > MEDIA_MAX_PIXELS)
    throw new Error(`image exceeds ${MEDIA_MAX_PIXELS} pixels`);
  const decoded = await decodeHeic({ buffer: original });
  if (decoded.width * decoded.height > MEDIA_MAX_PIXELS)
    throw new Error(`image exceeds ${MEDIA_MAX_PIXELS} pixels`);
  const pixels = Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  return {
    image: sharp(pixels, { raw: { width: decoded.width, height: decoded.height, channels: 4 } }),
    width: decoded.width,
    height: decoded.height,
  };
}

async function encodeVariants(
  oriented: Sharp,
  widths: readonly number[],
  format: 'avif' | 'webp',
): Promise<ConvertedVariant[]> {
  const variants: ConvertedVariant[] = [];
  for (const target of widths) {
    const resized = oriented.clone().resize({ width: target, withoutEnlargement: true });
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
  return variants;
}

/** AVIF before WebP at the same width, narrowest first. */
const byWidthThenFormat = (a: ConvertedVariant, b: ConvertedVariant) =>
  a.width - b.width || a.format.localeCompare(b.format);

/**
 * FR-MEDIA-03: xoay theo EXIF, bỏ toàn bộ metadata (EXIF/GPS/ICC: sharp chỉ giữ khi gọi
 * `withMetadata`), sinh WebP theo {@link planVariantWidths}, kèm ThumbHash và màu chủ đạo, rồi trả
 * `encodeAvif` để sinh tiếp AVIF. Ném lỗi khi không decode được hoặc ảnh quá nhiều điểm ảnh
 * (`limitInputPixels`).
 */
export async function convertImageInPhases(
  original: Uint8Array,
  options: ConvertOptions = {},
): Promise<ConvertedImageInPhases> {
  let oriented: Sharp;
  let width: number;
  let height: number;
  if (options.heic) {
    ({ image: oriented, width, height } = await decodeHeicPhoto(original));
  } else {
    const base = sharp(original, { limitInputPixels: MEDIA_MAX_PIXELS, failOn: 'error' }).rotate();
    const { data, info } = await base.clone().toBuffer({ resolveWithObject: true });
    oriented = sharp(data);
    ({ width, height } = info);
  }
  const widths = planVariantWidths(width);
  const webp = await encodeVariants(oriented, widths, 'webp');

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
    webp,
    encodeAvif: () => encodeVariants(oriented, widths, 'avif'),
  };
}

/** Both phases in one call, for callers (demo seeding, tests) that have no use for the early result. */
export async function convertImage(
  original: Uint8Array,
  options: ConvertOptions = {},
): Promise<ConvertedImage> {
  const { webp, encodeAvif, ...rest } = await convertImageInPhases(original, options);
  return { ...rest, variants: [...(await encodeAvif()), ...webp].sort(byWidthThenFormat) };
}
