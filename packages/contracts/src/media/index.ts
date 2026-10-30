import { MEDIA_PURPOSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, VersionSchema } from '../common';

/** FR-MEDIA: tệp tải lên qua `POST /media` (multipart, trường `file`), mục đích ở query `purpose`. */

export const MediaPurposeSchema = z.enum(MEDIA_PURPOSES);

export const UploadMediaQuerySchema = z.strictObject({
  purpose: MediaPurposeSchema,
});
export type UploadMediaQuery = z.infer<typeof UploadMediaQuerySchema>;

export const MediaStatusSchema = z.enum(['PROCESSING', 'READY', 'FAILED']);

export const MediaVariantResponseSchema = z.strictObject({
  format: z.enum(['avif', 'webp']),
  width: z.int().positive(),
  height: z.int().positive(),
  url: z.url(),
});

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
