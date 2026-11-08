import { CERTIFICATE_KINDS, MEDIA_PURPOSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, VersionSchema } from '../common';

/** FR-MEDIA: tệp tải lên qua `POST /media` (multipart, trường `file`), mục đích ở query `purpose`. */

export const MediaPurposeSchema = z.enum(MEDIA_PURPOSES);

export const CertificateKindSchema = z.enum(CERTIFICATE_KINDS);

/** Optional so older clients that do not classify still work; the API stores `UNKNOWN` without it. */
export const UploadMediaQuerySchema = z.strictObject({
  purpose: MediaPurposeSchema,
  kind: CertificateKindSchema.optional(),
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuerySchema>;

export const MediaStatusSchema = z.enum(['PROCESSING', 'READY', 'FAILED']);

export const MediaVariantResponseSchema = z.strictObject({
  format: z.enum(['avif', 'webp']),
  width: z.int().positive(),
  height: z.int().positive(),
  url: z.url(),
});
export type MediaVariantResponse = z.infer<typeof MediaVariantResponseSchema>;

/**
 * Trạng thái một tệp. Upload trả ngay `PROCESSING` (202); client hỏi lại cho tới `READY`.
 * Tệp riêng tư không bao giờ có `variants`: đọc qua `GET /media/{id}/read-url`.
 */
export const MediaAssetResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  purpose: MediaPurposeSchema,
  visibility: z.enum(['PUBLIC', 'PRIVATE']),
  status: MediaStatusSchema,
  mimeType: z.string(),
  sizeBytes: z.int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  thumbhash: z.string().nullable(),
  dominantColor: z.string().nullable(),
  /** What a private CERTIFICATE file evidences (vCRAFT-8my.3); `UNKNOWN` for unclassified files. */
  certificateKind: CertificateKindSchema.default('UNKNOWN'),
  variants: z.array(MediaVariantResponseSchema),
  createdAt: IsoDateTimeSchema,
});
export type MediaAssetResponse = z.infer<typeof MediaAssetResponseSchema>;

/** URL ký đọc tệp riêng tư, hạn 5 phút (FR-MEDIA-04). */
export const MediaReadUrlResponseSchema = z.strictObject({
  url: z.url(),
  expiresAt: IsoDateTimeSchema,
});
export type MediaReadUrlResponse = z.infer<typeof MediaReadUrlResponseSchema>;

/** Credit for a licensed image (CC BY / BY-SA require naming the author and licence). */
export const MediaCreditSchema = z.object({
  title: z.string(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.url(),
  sourceUrl: z.url(),
});
export type MediaCreditDto = z.infer<typeof MediaCreditSchema>;

/** `GET /media/credits`: credits of the licensed photos on published news, for the photo-credits page (GH#314). */
export const NewsPhotoCreditsResponseSchema = z.object({ data: z.array(MediaCreditSchema) });
export type NewsPhotoCreditsDto = z.infer<typeof NewsPhotoCreditsResponseSchema>;

/**
 * Credit as clients read it from public responses (GH#230): a credit without a usable licence or source URL
 * (an unknown licence is stored with empty URLs) reads as no credit, so one bad record never makes the whole
 * page fail its contract check.
 */
export const PublicCreditSchema = MediaCreditSchema.nullable().catch(null);

/** The API's side of the same rule: returns the credit only when both of its links are real URLs. */
export function publicCredit<T extends { licenseUrl: string; sourceUrl: string }>(
  credit: T | null | undefined,
): T | null {
  if (!credit) return null;
  return z.url().safeParse(credit.licenseUrl).success && z.url().safeParse(credit.sourceUrl).success
    ? credit
    : null;
}

/**
 * Public variants of a processed image: AVIF and WebP at each generated width. Empty for images that are
 * not in the media store (static demo photos), so clients fall back to the single `url`. Defaults to empty
 * when absent, so a web build that is newer than the API it talks to still parses the response.
 */
export const PublicImageVariantsSchema = z.array(MediaVariantResponseSchema).default([]);

/**
 * Public image linked through `media_link`; `credit` is null for the household's own photos. `url` is the
 * single ~1280 px WebP kept for older clients; `variants` lists every size for `srcset`, and `width`/`height`
 * are the intrinsic size (the aspect ratio) of the image.
 */
export const PublicImageSchema = z.object({
  mediaId: IdSchema,
  url: z.url(),
  width: z.int().positive().nullable().default(null),
  height: z.int().positive().nullable().default(null),
  variants: PublicImageVariantsSchema,
  alt: z.string(),
  /** English description for `/en`; null falls back to `alt`. Defaults to null so older APIs still parse. */
  altEn: z.string().nullable().default(null),
  caption: z.string().nullable(),
  credit: PublicCreditSchema,
});
export type PublicImageDto = z.infer<typeof PublicImageSchema>;
