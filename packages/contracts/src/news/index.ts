import { MATERIALS, NEWS_CATEGORIES, NEWS_STATUSES, NEWS_VISIBILITIES } from '@vcraft/domain';
import { z } from 'zod';
import {
  CursorPageQuerySchema,
  cursorPageSchema,
  IdSchema,
  IsoDateTimeSchema,
  PageCountersSchema,
  PageNumberSchema,
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

/**
 * `?householdSlug=` lọc tin của một hộ; `?category=` lọc theo loại. `?page=N` asks for one numbered page
 * with totals (GH#202, ADR-0020) and cannot be combined with `cursor`.
 */
export const ListNewsQuerySchema = CursorPageQuerySchema.extend({
  householdSlug: SlugSchema.optional(),
  category: NewsCategorySchema.optional(),
  page: PageNumberSchema.optional(),
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

const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

/** Prices in a `MATERIAL_PRICES` item (PLAN E11): clay, glaze and gas, each at most once. */
export const MaterialPriceDataSchema = z.object({
  effectiveOn: LocalDateSchema,
  prices: z
    .array(
      z.object({
        material: z.enum(MATERIALS),
        unit: z.string().trim().min(1).max(30),
        priceVnd: z.int().min(1).max(1_000_000_000),
      }),
    )
    .min(1)
    .max(MATERIALS.length)
    .refine((prices) => new Set(prices.map((p) => p.material)).size === prices.length, {
      message: 'Each material once',
    }),
});
export type MaterialPriceDataDto = z.infer<typeof MaterialPriceDataSchema>;

/** Planned cuts in a `POWER_SCHEDULE` item (PLAN E11), shown as a banner in Studio on the day. */
export const PowerScheduleDataSchema = z.object({
  outages: z
    .array(
      z
        .object({
          date: LocalDateSchema,
          from: LocalTimeSchema,
          to: LocalTimeSchema,
          area: z.string().trim().min(1).max(160),
        })
        .refine((o) => o.from < o.to, {
          message: 'The cut must end after it starts',
          path: ['to'],
        }),
    )
    .min(1)
    .max(20),
});
export type PowerScheduleDataDto = z.infer<typeof PowerScheduleDataSchema>;

/** `GET /news/material-prices`: six months of prices per material for the news page chart. */
export const MaterialPriceSeriesResponseSchema = z.object({
  series: z.array(
    z.object({
      material: z.enum(MATERIALS),
      unit: z.string(),
      points: z.array(z.object({ month: z.string(), priceVnd: z.int() })),
    }),
  ),
});
export type MaterialPriceSeriesDto = z.infer<typeof MaterialPriceSeriesResponseSchema>;

/** `GET /news/village/outages`: today's planned power cuts for the Studio banner. */
export const TodayOutagesResponseSchema = z.object({
  date: LocalDateSchema,
  outages: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      area: z.string(),
      newsSlug: z.string(),
    }),
  ),
});
export type TodayOutagesDto = z.infer<typeof TodayOutagesResponseSchema>;

export const NewsVisibilitySchema = z.enum(NEWS_VISIBILITIES);
export type NewsVisibilityDto = z.infer<typeof NewsVisibilitySchema>;

export const NewsDetailResponseSchema = NewsSummaryResponseSchema.extend({
  body: z.string(),
  /** Null on items written before the editor existed; the page then shows `body` as text. */
  bodyHtml: z.string().nullable(),
  visibility: NewsVisibilitySchema,
  /** Structured prices of a `MATERIAL_PRICES` item; null otherwise. */
  materialPrices: MaterialPriceDataSchema.nullable(),
  /** Planned cuts of a `POWER_SCHEDULE` item; null otherwise. */
  powerSchedule: PowerScheduleDataSchema.nullable(),
  /** Other items in the same category. */
  related: z.array(NewsSummaryResponseSchema),
});
export type NewsDetailDto = z.infer<typeof NewsDetailResponseSchema>;

export const NewsListResponseSchema = cursorPageSchema(NewsSummaryResponseSchema);
export type NewsListDto = z.infer<typeof NewsListResponseSchema>;

/** Response of `GET /news?page=N`: the cursor envelope (`nextCursor` null) plus page counters. */
export const NewsPageResponseSchema = NewsListResponseSchema.extend(PageCountersSchema.shape);
export type NewsPageDto = z.infer<typeof NewsPageResponseSchema>;

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
  /** Only with category `MATERIAL_PRICES`; null clears it. */
  materialPrices: MaterialPriceDataSchema.nullable().optional(),
  /** Only with category `POWER_SCHEDULE`; null clears it. */
  powerSchedule: PowerScheduleDataSchema.nullable().optional(),
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
  materialPrices: MaterialPriceDataSchema.nullable(),
  powerSchedule: PowerScheduleDataSchema.nullable(),
});
export type AdminNewsDto = z.infer<typeof AdminNewsSchema>;
export const AdminNewsListSchema = cursorPageSchema(AdminNewsSchema);
export type AdminNewsListDto = z.infer<typeof AdminNewsListSchema>;
