import { NEWS_CATEGORIES, NEWS_STATUSES, NEWS_VISIBILITIES } from '@vcraft/domain';
import { z } from 'zod';
import {
  CursorPageQuerySchema,
  cursorPageSchema,
  IdSchema,
  IsoDateTimeSchema,
  SlugSchema,
  VersionSchema,
} from '../common';
import { PublicImageSchema } from '../media';

/**
 * Tin tức làng nghề (vCRAFT-83g): `GET /news` (danh sách công khai) và `GET /news/{slug}`.
 * `body` là văn bản thuần. `bodyHtml` là HTML đã làm sạch ở API; chỉ trường này được dựng thành HTML.
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
  /** Null when the news item has no cover. */
  cover: PublicImageSchema.nullable(),
});
export type NewsSummaryDto = z.infer<typeof NewsSummaryResponseSchema>;

export const NewsVisibilitySchema = z.enum(NEWS_VISIBILITIES);
export type NewsVisibilityDto = z.infer<typeof NewsVisibilitySchema>;

export const NewsDetailResponseSchema = NewsSummaryResponseSchema.extend({
  body: z.string(),
  /** Null on items written before the editor existed; the page then shows `body` as text. */
  bodyHtml: z.string().nullable(),
  visibility: NewsVisibilitySchema,
  /** Other items in the same category. */
  related: z.array(NewsSummaryResponseSchema),
});
export type NewsDetailDto = z.infer<typeof NewsDetailResponseSchema>;

export const NewsListResponseSchema = cursorPageSchema(NewsSummaryResponseSchema);
export type NewsListDto = z.infer<typeof NewsListResponseSchema>;

/** `POST /admin/news`, `PUT /admin/news/:id`. The version travels in `If-Match`. */
export const SaveNewsRequestSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  /** Derived from the title when left out. */
  slug: SlugSchema.optional(),
  summary: z.string().trim().min(1).max(500),
  /** Sanitized by the API before it is stored. */
  bodyHtml: z.string().min(1).max(200_000),
  category: NewsCategorySchema,
  visibility: NewsVisibilitySchema,
  pinned: z.boolean(),
  important: z.boolean(),
  status: z.enum(NEWS_STATUSES),
  /** A future time schedules a `PUBLISHED` item. Left out, it goes live now. */
  publishAt: IsoDateTimeSchema.optional(),
  /** A processed image uploaded by this administrator. `null` removes the cover. */
  coverMediaId: IdSchema.nullable().optional(),
  coverAlt: z.string().trim().max(500).optional(),
});
export type SaveNewsRequest = z.infer<typeof SaveNewsRequestSchema>;

export const ListAdminNewsQuerySchema = CursorPageQuerySchema.extend({
  state: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED']).optional(),
});
export type ListAdminNewsQuery = z.infer<typeof ListAdminNewsQuerySchema>;

export const AdminNewsSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  bodyHtml: z.string(),
  category: NewsCategorySchema,
  visibility: NewsVisibilitySchema,
  pinned: z.boolean(),
  important: z.boolean(),
  state: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED']),
  publishedAt: IsoDateTimeSchema.nullable(),
  cover: PublicImageSchema.nullable(),
  householdName: z.string().nullable(),
  updatedAt: IsoDateTimeSchema,
});
export type AdminNewsDto = z.infer<typeof AdminNewsSchema>;
export const AdminNewsListSchema = cursorPageSchema(AdminNewsSchema);
export type AdminNewsListDto = z.infer<typeof AdminNewsListSchema>;
