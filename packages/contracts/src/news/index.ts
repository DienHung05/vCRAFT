import { NEWS_CATEGORIES } from '@vcraft/domain';
import { z } from 'zod';
import { CursorPageQuerySchema, cursorPageSchema, IsoDateTimeSchema, SlugSchema } from '../common';
import { PublicImageSchema } from '../media';

/**
 * Tin tức làng nghề (vCRAFT-83g): `GET /news` (danh sách công khai) và `GET /news/{slug}`.
 * Nội dung `body` là văn bản thuần; client hiển thị như văn bản, không dựng HTML từ đó.
 */

export const NewsCategorySchema = z.enum(NEWS_CATEGORIES);
export type NewsCategoryDto = z.infer<typeof NewsCategorySchema>;

/** `?householdSlug=` lọc tin của một hộ; `?category=` lọc theo loại. */
export const ListNewsQuerySchema = CursorPageQuerySchema.extend({
  householdSlug: SlugSchema.optional(),
  category: NewsCategorySchema.optional(),
});
export type ListNewsQuery = z.infer<typeof ListNewsQuerySchema>;

export const NewsSummaryResponseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  category: NewsCategorySchema,
  pinned: z.boolean(),
  publishedAt: IsoDateTimeSchema,
  /** Trống khi là tin chung của làng. */
  householdName: z.string().nullable(),
  householdSlug: z.string().nullable(),
  /** Trống khi tin chưa có ảnh bìa. */
  cover: PublicImageSchema.nullable(),
});
export type NewsSummaryDto = z.infer<typeof NewsSummaryResponseSchema>;

export const NewsDetailResponseSchema = NewsSummaryResponseSchema.extend({
  body: z.string(),
});
export type NewsDetailDto = z.infer<typeof NewsDetailResponseSchema>;

export const NewsListResponseSchema = cursorPageSchema(NewsSummaryResponseSchema);
export type NewsListDto = z.infer<typeof NewsListResponseSchema>;
