import {
  HOUSEHOLD_STATUSES,
  isValidOpeningInterval,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  PROFILE_SECTIONS,
} from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, SlugSchema, VersionSchema } from '../common';
import { JournalResponseSchema } from '../journal';

/** Hộ sản xuất, xưởng, nghệ nhân, sản phẩm và các quyết định duyệt / xuất bản (vCRAFT-9hg.2, 9hg.3). */

export const HouseholdStatusSchema = z.enum(HOUSEHOLD_STATUSES);
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export const WorkshopPurposeSchema = z.enum(['PRODUCTION', 'SHOWROOM', 'BOTH']);
export const ProductKindSchema = z.enum(['OBJECT', 'BATCH']);
const CategorySchema = z.enum(PRODUCT_CATEGORIES);

const NameSchema = z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(160);
const TimeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ có dạng HH:mm');

/** Một khoảng mở cửa trong tuần (FR-ART-05), giờ Việt Nam. */
export const OpeningIntervalSchema = z
  .object({ day: z.int().min(0).max(6), open: TimeOfDaySchema, close: TimeOfDaySchema })
  .refine(isValidOpeningInterval, { message: 'Giờ mở phải trước giờ đóng', path: ['close'] });
export type OpeningIntervalDto = z.infer<typeof OpeningIntervalSchema>;

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

const CURRENT_YEAR_LIMIT = 2100;
const YearSchema = z.int().min(1000, 'Năm không hợp lệ').max(CURRENT_YEAR_LIMIT);

export const TimelineEventSchema = z.object({
  year: YearSchema,
  title: z.string().trim().min(2, 'Hãy đặt tiêu đề').max(160),
  text: z.string().trim().max(1_000).default(''),
});

const CertificationInputSchema = z.object({
  name: z.string().trim().min(2, 'Hãy ghi tên chứng nhận').max(160),
  issuer: z.string().trim().min(2, 'Hãy ghi đơn vị cấp').max(160),
  year: YearSchema,
});

const AltSchema = z.string().trim().min(3, 'Hãy mô tả điều nhìn thấy trong ảnh').max(300);

/** Hộ chỉ gắn ảnh mình đã tải lên, hoặc giữ lại ảnh có sẵn trong bộ ảnh mẫu. */
const GalleryInputSchema = z.union([
  z.object({ mediaId: IdSchema, alt: AltSchema, caption: z.string().trim().max(200).optional() }),
  z.object({
    url: z.string().regex(/^\/images\/demo\/[\w-]+\.(?:webp|avif)$/),
    alt: AltSchema,
    caption: z.string().trim().max(200).optional(),
  }),
]);

const CapacitySchema = z.partialRecord(z.enum(PRODUCT_CATEGORIES), z.int().min(0).max(10_000_000));

/** Sửa hồ sơ hộ (FR-ART-01 … 06): chỉ gửi phần đổi; `If-Match` bắt buộc. */
export const UpdateHouseholdProfileRequestSchema = z.object({
  history: z.string().trim().max(10_000).optional(),
  craft: z.string().trim().max(160).optional(),
  village: z.string().trim().max(160).optional(),
  foundedYear: YearSchema.nullable().optional(),
  generations: z.int().min(1).max(50).nullable().optional(),
  timeline: z.array(TimelineEventSchema).max(50).optional(),
  certifications: z.array(CertificationInputSchema).max(30).optional(),
  gallery: z.array(GalleryInputSchema).max(30).optional(),
  capacityByCategory: CapacitySchema.optional(),
});
export type UpdateHouseholdProfileRequest = z.infer<typeof UpdateHouseholdProfileRequestSchema>;

export const CreateWorkshopRequestSchema = z.object({
  name: NameSchema,
  address: z.string().trim().min(5).max(300),
  purpose: WorkshopPurposeSchema.default('PRODUCTION'),
  acceptsVisitors: z.boolean().default(false),
  visitingInfo: z.string().trim().max(2_000).optional(),
  openingHours: z.array(OpeningIntervalSchema).max(21).optional(),
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
    category: CategorySchema.default('DECOR'),
    priceVnd: z.int().min(0).max(2_000_000_000).default(0),
    stock: z.int().min(0).max(1_000_000).default(0),
    material: z.string().trim().max(200).optional(),
    dimensions: z.string().trim().max(200).optional(),
    weightGrams: z.int().positive().max(1_000_000).optional(),
    artisanNote: z.string().trim().max(2_000).optional(),
  })
  .refine((p) => (p.kind === 'BATCH') === (p.batchSize !== undefined), {
    message: 'Lô sản xuất cần số lượng vật trong lô; vật đơn chiếc thì không',
    path: ['batchSize'],
  });
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

export const WithdrawProductRequestSchema = z.object({ reason: ReasonSchema });

/** Ghi công người làm cho sản phẩm (thay toàn bộ danh sách, theo thứ tự hiển thị). */
export const SetProductMakersRequestSchema = z.object({
  makers: z
    .array(
      z.object({
        artisanId: IdSchema,
        contribution: z.string().trim().min(2, 'Ghi rõ phần việc, vd. "Vuốt dáng"').max(160),
      }),
    )
    .min(1, 'Ghi công ít nhất một người làm')
    .max(20),
});
export type SetProductMakersRequest = z.infer<typeof SetProductMakersRequestSchema>;

// --- Response ---

export const WorkshopResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  address: z.string(),
  purpose: WorkshopPurposeSchema,
  acceptsVisitors: z.boolean(),
  visitingInfo: z.string().nullable(),
  openingHours: z.array(OpeningIntervalSchema).nullable(),
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

/** Một người làm được ghi công: tên riêng và phần việc (vCRAFT-9hg.6). */
export const MakerCreditSchema = z.object({
  artisanId: IdSchema,
  name: z.string(),
  craftRole: z.string().nullable(),
  contribution: z.string(),
});
export type MakerCreditDto = z.infer<typeof MakerCreditSchema>;

export const ProductResponseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  slug: z.string(),
  traceCode: z.string(),
  description: z.string(),
  kind: ProductKindSchema,
  batchSize: z.int().nullable(),
  category: CategorySchema,
  priceVnd: z.int().nonnegative(),
  stock: z.int().nonnegative(),
  material: z.string().nullable(),
  dimensions: z.string().nullable(),
  weightGrams: z.int().nullable(),
  artisanNote: z.string().nullable(),
  coverUrl: z.string().nullable(),
  coverAlt: z.string().nullable(),
  status: ProductStatusSchema,
  publishedAt: IsoDateTimeSchema.nullable(),
  makers: z.array(MakerCreditSchema),
  /** Người đăng luôn là ban điều hành hộ, không phải người làm. */
  postedBy: z.literal('HOUSEHOLD_ADMINISTRATION'),
});
export type ProductDto = z.infer<typeof ProductResponseSchema>;

/** Hồ sơ công khai: chỉ có khi hộ `APPROVED`; không lộ lý do, trạng thái hay người đại diện. */
export const PublicHouseholdResponseSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: z.string(),
  history: z.string(),
  village: z.string().nullable(),
  craft: z.string().nullable(),
  coverUrl: z.string().nullable(),
  foundedYear: z.int().nullable(),
  generations: z.int().nullable(),
  timeline: z.array(TimelineEventSchema),
  certifications: z.array(CertificationInputSchema.extend({ verified: z.boolean() })),
  /** `url` trống khi ảnh còn chờ xử lý; trang công khai bỏ qua các ảnh đó. */
  gallery: z.array(
    z.object({
      mediaId: IdSchema.nullable(),
      url: z.string().nullable(),
      alt: z.string(),
      caption: z.string().nullable(),
    }),
  ),
  capacityByCategory: CapacitySchema,
  artisans: z.array(ArtisanResponseSchema),
  workshops: z.array(WorkshopResponseSchema),
  /** Phòng trưng bày đón khách, tách khỏi các xưởng chỉ để sản xuất. */
  visit: z.object({
    showrooms: z.array(WorkshopResponseSchema),
    productionWorkshops: z.array(WorkshopResponseSchema),
  }),
  products: z.array(ProductResponseSchema),
});
export type PublicHouseholdDto = z.infer<typeof PublicHouseholdResponseSchema>;

/** Hồ sơ riêng cho người đại diện và Ban quản lý: luôn đọc được kể cả khi bị tạm ngừng. */
export const HouseholdResponseSchema = PublicHouseholdResponseSchema.extend({
  version: VersionSchema,
  status: HouseholdStatusSchema,
  statusReason: z.string().nullable(),
  approvedAt: IsoDateTimeSchema.nullable(),
  completeness: z.object({
    percent: z.int().min(0).max(100),
    missing: z.array(z.enum(PROFILE_SECTIONS)),
  }),
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
    journal: JournalResponseSchema,
  }),
  z.object({
    availability: z.literal('UNAVAILABLE'),
    traceCode: z.string(),
    /** Hộ bị khóa thì trang QR cảnh báo hàng không xác thực; sản phẩm rút chỉ là thông báo. */
    reason: z.enum(['HOUSEHOLD_SUSPENDED', 'PRODUCT_WITHDRAWN']),
  }),
]);
export type TraceAvailabilityDto = z.infer<typeof TraceAvailabilityResponseSchema>;

/** Chi tiết công khai của một sản phẩm: nội dung, hộ làm ra và nhật ký để tóm tắt. */
export const ProductDetailResponseSchema = z.object({
  product: ProductResponseSchema,
  household: z.object({ name: z.string(), slug: z.string() }),
  journal: JournalResponseSchema,
});
export type ProductDetailDto = z.infer<typeof ProductDetailResponseSchema>;

/**
 * Ghim bản đồ làng (chỉ hộ đã duyệt, chỉ xưởng có tọa độ). Trang luôn hiện kèm danh sách chữ làm
 * phương án dễ tiếp cận; bản đồ chỉ là minh họa thêm (vCRAFT-9hg.6).
 */
export const MapPinSchema = z.object({
  workshopId: IdSchema,
  workshopName: z.string(),
  address: z.string(),
  purpose: WorkshopPurposeSchema,
  visitable: z.boolean(),
  visitingInfo: z.string().nullable(),
  /** Trình duyệt tự tính "đang mở" từ đây bằng `openState` (giờ Việt Nam). */
  openingHours: z.array(OpeningIntervalSchema).nullable(),
  lat: z.number(),
  lng: z.number(),
  household: z.object({
    name: z.string(),
    slug: z.string(),
    craft: z.string().nullable(),
    coverUrl: z.string().nullable(),
  }),
});
export type MapPinDto = z.infer<typeof MapPinSchema>;

export const MapPinsResponseSchema = z.object({ data: z.array(MapPinSchema) });
export type MapPinsDto = z.infer<typeof MapPinsResponseSchema>;
