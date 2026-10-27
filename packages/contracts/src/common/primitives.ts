import { z } from 'zod';

/** Id thực thể: UUID (User.id = `sub` của Supabase; các bảng khác cũng dùng uuid). */
export const IdSchema = z.uuid();
export type Id = z.infer<typeof IdSchema>;

/**
 * Slug ASCII không dấu, chữ thường, nối bằng `-` (vd. `binh-gom-men-ran-bt7k2qxm`).
 * Dấu tiếng Việt bị loại ở bước sinh slug (`slugify` trong `@vcraft/utils`), không ở đây.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(SLUG_PATTERN, 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang');
export type Slug = z.infer<typeof SlugSchema>;

/**
 * Số tiền VND: số nguyên không âm, an toàn trong JS (<= 2^53-1) — đủ cho cột `bigint` của CSDL
 * mà không phải truyền chuỗi. Tiền không bao giờ là số thực.
 */
export const VndSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
export type Vnd = z.infer<typeof VndSchema>;

/** Khoảng ngân sách (QuoteRequest.budgetMin/MaxVnd): min <= max khi có đủ hai đầu. */
export const VndRangeSchema = z
  .object({ min: VndSchema.optional(), max: VndSchema.optional() })
  .refine((range) => range.min === undefined || range.max === undefined || range.min <= range.max, {
    message: 'Ngân sách tối thiểu không được lớn hơn tối đa',
    path: ['min'],
  });
export type VndRange = z.infer<typeof VndRangeSchema>;

/** Thời điểm ISO 8601 có múi giờ (`Z` hoặc offset); API luôn trả UTC `Z`. */
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/** Ngày ISO `YYYY-MM-DD` (không giờ). */
export const IsoDateSchema = z.iso.date();
export type IsoDate = z.infer<typeof IsoDateSchema>;

/** Ngôn ngữ giao diện / nội dung (NFR-I18N-01). */
export const LOCALES = ['vi', 'en'] as const;
export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;
export const DEFAULT_LOCALE: Locale = 'vi';

/** Số phiên bản khóa lạc quan (BR-L1). */
export const VersionSchema = z.int().min(0);
export type Version = z.infer<typeof VersionSchema>;
