import { PRODUCT_CATEGORIES } from '@vcraft/domain';
import { z } from 'zod';
import { CursorPageQuerySchema, cursorPageSchema, IsoDateTimeSchema, SlugSchema } from '../common';
import { OpeningIntervalSchema, ProductKindSchema } from '../households';
import { PublicImageVariantsSchema } from '../media';

/** Danh mục công khai (FR-CAT-01 … 04): lọc, sắp xếp, phân trang con trỏ, tìm không dấu. */

export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);
export type ProductCategoryDto = z.infer<typeof ProductCategorySchema>;

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export const ProductSortSchema = z.enum(PRODUCT_SORTS);
export type ProductSort = z.infer<typeof ProductSortSchema>;

const FlagSchema = z.enum(['true', 'false']).transform((value) => value === 'true');
const PriceSchema = z.coerce.number().int().min(0).max(2_000_000_000);

export const ListProductsQuerySchema = CursorPageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  category: ProductCategorySchema.optional(),
  household: SlugSchema.optional(),
  minPrice: PriceSchema.optional(),
  maxPrice: PriceSchema.optional(),
  oneOfAKind: FlagSchema.optional(),
  inStock: FlagSchema.optional(),
  sort: ProductSortSchema.default('newest'),
});
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;

/** Thẻ sản phẩm trong danh mục: đủ để vẽ lưới, không kèm nhật ký. */
export const ProductCardSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  traceCode: z.string(),
  kind: ProductKindSchema,
  category: ProductCategorySchema,
  priceVnd: z.int().nonnegative(),
  stock: z.int().nonnegative(),
  coverUrl: z.string().nullable(),
  coverVariants: PublicImageVariantsSchema,
  coverAlt: z.string().nullable(),
  /** English description of the cover for `/en`; null falls back to `coverAlt`. */
  coverAltEn: z.string().nullable().default(null),
  publishedAt: IsoDateTimeSchema.nullable(),
  household: z.object({ name: z.string(), slug: z.string() }),
});
export type ProductCardDto = z.infer<typeof ProductCardSchema>;

export const ProductListResponseSchema = cursorPageSchema(ProductCardSchema);
export type ProductListDto = z.infer<typeof ProductListResponseSchema>;

/** Một dòng trong danh sách hộ công khai. */
export const HouseholdSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  village: z.string().nullable(),
  craft: z.string().nullable(),
  coverUrl: z.string().nullable(),
  coverVariants: PublicImageVariantsSchema,
  /** What the cover shows (the household banner's description); null when it has no linked description. */
  coverAlt: z.string().nullable().default(null),
  /** English description of the cover for `/en`; null falls back to `coverAlt`. */
  coverAltEn: z.string().nullable().default(null),
  representative: z.string().nullable(),
  productCount: z.int().nonnegative(),
  /** Giờ của nơi đón khách đầu tiên; `null` là hộ không có nơi đón khách. */
  openingHours: z.array(OpeningIntervalSchema).nullable(),
});
export type HouseholdSummaryDto = z.infer<typeof HouseholdSummarySchema>;

export const HouseholdListResponseSchema = z.object({ data: z.array(HouseholdSummarySchema) });
export type HouseholdListDto = z.infer<typeof HouseholdListResponseSchema>;

export const SearchQuerySchema = z.object({ q: z.string().trim().min(1).max(120) });

/** Gợi ý tức thời (FR-CAT-04), mỗi nhóm tối đa 5 mục. */
export const SearchSuggestionsSchema = z.object({
  products: z.array(z.object({ name: z.string(), slug: z.string(), household: z.string() })),
  households: z.array(z.object({ name: z.string(), slug: z.string() })),
  news: z.array(z.object({ title: z.string(), slug: z.string() })),
});
export type SearchSuggestionsDto = z.infer<typeof SearchSuggestionsSchema>;

/** Số liệu làng trên trang chủ. */
export const VillageStatsSchema = z.object({
  households: z.int().nonnegative(),
  products: z.int().nonnegative(),
  artisans: z.int().nonnegative(),
});
export type VillageStatsDto = z.infer<typeof VillageStatsSchema>;
