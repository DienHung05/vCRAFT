import { HOUSEHOLD_STATUSES, PRODUCT_STATUSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, SlugSchema, VersionSchema } from '../common';

/** Hộ sản xuất, xưởng, nghệ nhân, sản phẩm và các quyết định duyệt / xuất bản (vCRAFT-9hg.2, 9hg.3). */

export const HouseholdStatusSchema = z.enum(HOUSEHOLD_STATUSES);
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export const WorkshopPurposeSchema = z.enum(['PRODUCTION', 'SHOWROOM', 'BOTH']);
export const ProductKindSchema = z.enum(['OBJECT', 'BATCH']);

const NameSchema = z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(160);
const ReasonSchema = z.string().trim().min(3, 'Hãy ghi lý do (ít nhất 3 ký tự)').max(500);

// --- Request ---

export const ApplyHouseholdRequestSchema = z.object({
  name: NameSchema,
  slug: SlugSchema,
  history: z.string().trim().max(10_000).default(''),
  village: z.string().trim().max(160).optional(),
});
export type ApplyHouseholdRequest = z.infer<typeof ApplyHouseholdRequestSchema>;

/** Quyết định của Ban quản lý; `reason` bắt buộc với từ chối và tạm ngừng (domain kiểm). */
export const HouseholdDecisionRequestSchema = z.object({
  reason: ReasonSchema.optional(),
});
export type HouseholdDecisionRequest = z.infer<typeof HouseholdDecisionRequestSchema>;

export const ListHouseholdsQuerySchema = z.object({
  status: HouseholdStatusSchema.optional(),
});

export const CreateWorkshopRequestSchema = z.object({
  name: NameSchema,
  address: z.string().trim().min(5).max(300),
  purpose: WorkshopPurposeSchema.default('PRODUCTION'),
  acceptsVisitors: z.boolean().default(false),
  visitingInfo: z.string().trim().max(2_000).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type CreateWorkshopRequest = z.infer<typeof CreateWorkshopRequestSchema>;

export const CreateArtisanRequestSchema = z.object({
  name: NameSchema,
  craftRole: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2_000).optional(),
});
export type CreateArtisanRequest = z.infer<typeof CreateArtisanRequestSchema>;

export const CreateProductRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(10_000).default(''),
    kind: ProductKindSchema.default('OBJECT'),
    batchSize: z.int().min(2).max(100_000).optional(),
  })
  .refine((p) => (p.kind === 'BATCH') === (p.batchSize !== undefined), {
    message: 'Lô sản xuất cần số lượng vật trong lô; vật đơn chiếc thì không',
    path: ['batchSize'],
  });
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const WithdrawProductRequestSchema = z.object({ reason: ReasonSchema });

// --- Response ---

export const WorkshopResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  address: z.string(),
  purpose: WorkshopPurposeSchema,
  acceptsVisitors: z.boolean(),
  visitingInfo: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type WorkshopDto = z.infer<typeof WorkshopResponseSchema>;

export const ArtisanResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  craftRole: z.string().nullable(),
  bio: z.string().nullable(),
});
export type ArtisanDto = z.infer<typeof ArtisanResponseSchema>;

export const ProductResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  slug: z.string(),
  traceCode: z.string(),
  description: z.string(),
  kind: ProductKindSchema,
  batchSize: z.int().nullable(),
  status: ProductStatusSchema,
  publishedAt: IsoDateTimeSchema.nullable(),
});
export type ProductDto = z.infer<typeof ProductResponseSchema>;

/** Hồ sơ công khai: chỉ có khi hộ `APPROVED`; không lộ lý do, trạng thái hay người đại diện. */
export const PublicHouseholdResponseSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: z.string(),
  history: z.string(),
  village: z.string().nullable(),
  artisans: z.array(ArtisanResponseSchema),
  workshops: z.array(WorkshopResponseSchema),
  products: z.array(ProductResponseSchema),
});
export type PublicHouseholdDto = z.infer<typeof PublicHouseholdResponseSchema>;

/** Hồ sơ riêng cho người đại diện và Ban quản lý: luôn đọc được kể cả khi bị tạm ngừng. */
export const HouseholdResponseSchema = PublicHouseholdResponseSchema.extend({
  version: VersionSchema,
  status: HouseholdStatusSchema,
  statusReason: z.string().nullable(),
  approvedAt: IsoDateTimeSchema.nullable(),
});
export type HouseholdDto = z.infer<typeof HouseholdResponseSchema>;

/**
 * Tra một mã QR: `VISIBLE` kèm dữ liệu; `UNAVAILABLE` chỉ là thông báo (hộ tạm ngừng hoặc sản phẩm
 * đã rút), không kèm nội dung. Mã sai hoặc chưa từng công khai trả 404.
 */
export const TraceAvailabilityResponseSchema = z.discriminatedUnion('availability', [
  z.object({
    availability: z.literal('VISIBLE'),
    product: ProductResponseSchema,
    household: z.object({ name: z.string(), slug: z.string() }),
  }),
  z.object({ availability: z.literal('UNAVAILABLE'), traceCode: z.string() }),
]);
export type TraceAvailabilityDto = z.infer<typeof TraceAvailabilityResponseSchema>;
