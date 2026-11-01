import { JOURNAL_STAGES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateSchema, IsoDateTimeSchema, VersionSchema } from '../common';
import { MediaCreditSchema, PublicImageVariantsSchema } from '../media';

/** Nhật ký sản xuất và mốc đính chính (vCRAFT-9hg.4). */

export const JournalStageSchema = z.enum(JOURNAL_STAGES);

const Sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, 'SHA-256 phải là 64 ký tự hex thường');

export const JournalImageSchema = z.object({
  url: z.url().max(2_000),
  sha256: Sha256HexSchema,
});
export type JournalImageDto = z.infer<typeof JournalImageSchema>;

const JournalContentSchema = z.object({
  stage: JournalStageSchema,
  /** Ngày hộ khai; lùi ngày hay ngày tương lai đều hiện đúng như khai. */
  declaredDate: IsoDateSchema,
  note: z.string().trim().min(1, 'Hãy ghi vài dòng về công đoạn này').max(2_000),
  images: z.array(JournalImageSchema).max(12).default([]),
  /** Một dòng lý do khi bỏ qua công đoạn trước đó chưa ghi. */
  skipReason: z.string().trim().max(300).optional(),
});

export const CreateJournalEntryRequestSchema = JournalContentSchema.extend({
  /** Có giá trị ⇒ đây là mốc đính chính thay cho mốc này (chỉ sau khi xuất bản). */
  supersedesEntryId: IdSchema.optional(),
});
export type CreateJournalEntryRequest = z.infer<typeof CreateJournalEntryRequestSchema>;

/** Sửa trực tiếp, chỉ trước lần xuất bản đầu tiên. */
export const UpdateJournalEntryRequestSchema = JournalContentSchema;
export type UpdateJournalEntryRequest = z.infer<typeof UpdateJournalEntryRequestSchema>;

export const JournalEntryResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  seq: z.int().min(0),
  stage: JournalStageSchema,
  declaredDate: IsoDateSchema,
  note: z.string(),
  /**
   * `credit` and `variants` come from `media_asset` by `sha256` and are not part of the hash chain.
   * `credit` is null for the household's own photos; `variants` is empty when the file is not in the media store.
   */
  images: z.array(
    JournalImageSchema.extend({
      credit: MediaCreditSchema.nullable(),
      variants: PublicImageVariantsSchema,
    }),
  ),
  skipReason: z.string().nullable(),
  /** `seq` của mốc mà mốc này đính chính. */
  supersedesSeq: z.int().nullable(),
  /** `seq` của mốc đính chính thay cho mốc này (mốc gốc vẫn hiện). */
  supersededBySeq: z.int().nullable(),
  /** Lúc hệ thống lưu mốc. */
  recordedAt: IsoDateTimeSchema,
  prevHash: z.string(),
  hash: z.string(),
});
export type JournalEntryDto = z.infer<typeof JournalEntryResponseSchema>;

export const JournalResponseSchema = z.object({
  /** Khóa băm của chuỗi (đầu vào `productId` của `computeEntryHash`). */
  productId: IdSchema,
  entries: z.array(JournalEntryResponseSchema),
  inProgress: z.boolean(),
  missingStages: z.array(JournalStageSchema),
});
export type JournalDto = z.infer<typeof JournalResponseSchema>;
