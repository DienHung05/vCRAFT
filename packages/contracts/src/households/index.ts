import {
  CRAFT_CATEGORIES,
  certificationYear,
  HOUSEHOLD_REVIEW_STATES,
  HOUSEHOLD_STATUSES,
  ID_NUMBER_PATTERN,
  isValidOpeningInterval,
  MAX_PRODUCT_TAG_LENGTH,
  MAX_PRODUCT_TAGS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  PROFILE_SECTIONS,
  VILLAGE_AREA_CODES,
} from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateSchema, IsoDateTimeSchema, SlugSchema, VersionSchema } from '../common';
import { JournalResponseSchema } from '../journal';
import {
  CertificateKindSchema,
  PublicCreditSchema,
  PublicImageSchema,
  PublicImageVariantsSchema,
} from '../media';

/** Hộ sản xuất, xưởng, nghệ nhân, sản phẩm và các quyết định duyệt / xuất bản (vCRAFT-9hg.2, 9hg.3). */

export const HouseholdStatusSchema = z.enum(HOUSEHOLD_STATUSES);
export const HouseholdReviewStateSchema = z.enum(HOUSEHOLD_REVIEW_STATES);
export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export const WorkshopPurposeSchema = z.enum(['PRODUCTION', 'SHOWROOM', 'BOTH']);
/** The hamlet of a workshop (ADR-0023). */
export const VillageAreaCodeSchema = z.enum(VILLAGE_AREA_CODES);
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

/** Representative's citizen ID number (CCCD): exactly 12 digits (NFR-SEC-03, stored encrypted). */
export const IdNumberSchema = z
  .string()
  .trim()
  .regex(ID_NUMBER_PATTERN, 'Số CCCD gồm đúng 12 chữ số');

export const ApplyHouseholdRequestSchema = z.object({
  name: NameSchema,
  slug: SlugSchema,
  history: z.string().trim().max(10_000).default(''),
  village: z.string().trim().max(160).optional(),
  /** Optional for households that applied before the number was collected; the wizard requires it. */
  idNumber: IdNumberSchema.optional(),
});
export type ApplyHouseholdRequest = z.infer<typeof ApplyHouseholdRequestSchema>;

/** `PUT /me/household/id-number`: add or replace the representative's citizen ID number. */
export const SetIdNumberRequestSchema = z.strictObject({ idNumber: IdNumberSchema });
export type SetIdNumberRequest = z.infer<typeof SetIdNumberRequestSchema>;

/** `GET /admin/households/:id/id-number`: the full number, shown on explicit request and audited. */
export const RevealedIdNumberResponseSchema = z.strictObject({ idNumber: z.string().nullable() });
export type RevealedIdNumberDto = z.infer<typeof RevealedIdNumberResponseSchema>;

/** Quyết định của Ban quản lý; `reason` bắt buộc với từ chối và tạm ngừng (domain kiểm). */
export const HouseholdDecisionRequestSchema = z.object({
  reason: ReasonSchema.optional(),
});
export type HouseholdDecisionRequest = z.infer<typeof HouseholdDecisionRequestSchema>;

/** `POST /me/household/resubmit`: the representative explicitly resubmits the application after edits (vCRAFT-8my.2). */
export const ResubmitHouseholdResponseSchema = z.object({
  version: VersionSchema,
  resubmittedAt: IsoDateTimeSchema,
  reviewState: HouseholdReviewStateSchema,
});
export type ResubmitHouseholdDto = z.infer<typeof ResubmitHouseholdResponseSchema>;

export const ListHouseholdsQuerySchema = z.object({
  status: HouseholdStatusSchema.optional(),
  /** Ngày nộp hồ sơ, tính cả hai đầu. */
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
});

/** Một dòng trong hàng đợi duyệt hộ. */
export const AdminHouseholdSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string(),
  status: HouseholdStatusSchema,
  reviewState: HouseholdReviewStateSchema,
  resubmittedAt: IsoDateTimeSchema.nullable().default(null),
  submittedAt: IsoDateTimeSchema,
});
export type AdminHouseholdDto = z.infer<typeof AdminHouseholdSchema>;
export const AdminHouseholdListSchema = z.array(AdminHouseholdSchema);

/** Giấy tờ xác minh riêng tư; nội dung chỉ đọc qua URL ký 5 phút (FR-MEDIA-04). */
export const HouseholdDocumentSchema = z.object({
  id: IdSchema,
  mimeType: z.string(),
  /** What the document is (for example "Căn cước công dân"); null when the file has no caption. */
  caption: z.string().nullable().default(null),
  /** What the document evidences (vCRAFT-8my.3); `UNKNOWN` for uploads made before classification. */
  certificateKind: CertificateKindSchema.default('UNKNOWN'),
  sizeBytes: z.int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});
export type HouseholdDocumentDto = z.infer<typeof HouseholdDocumentSchema>;
export const HouseholdDocumentListSchema = z.object({ data: z.array(HouseholdDocumentSchema) });

/** One Vietnam calendar date (`YYYY-MM-DD`) of the dashboard's QR-scan trend. */
export const AdminDashboardTrendPointSchema = z.object({
  /** `YYYY-MM-DD`, a Vietnam calendar date (UTC+7). */
  date: IsoDateSchema,
  count: z.int().nonnegative(),
});
export type AdminDashboardTrendPointDto = z.infer<typeof AdminDashboardTrendPointSchema>;

/** Overview figures of the village board (FR-ADM-06). */
export const AdminDashboardSchema = z.object({
  activeHouseholds: z.int().nonnegative(),
  pendingApplications: z.int().nonnegative(),
  openRfqs: z.int().nonnegative(),
  ordersInProduction: z.int().nonnegative(),
  qrScans30Days: z.int().nonnegative(),
  /**
   * QR scans per day over the last 30 Vietnam calendar dates (UTC+7) including today, oldest first.
   * Counts only persisted `trace_scan` rows and zero-fills the dates without scans — historical
   * totals are never invented from present ones.
   */
  trend: z.array(AdminDashboardTrendPointSchema).optional(),
});
export type AdminDashboardDto = z.infer<typeof AdminDashboardSchema>;

/** Device classes a QR scan is bucketed into (FR-TRC-06); derived from the User-Agent, which is never stored. */
export const SCAN_DEVICE_TYPES = ['mobile', 'tablet', 'desktop', 'bot', 'unknown'] as const;
export const ScanDeviceTypeSchema = z.enum(SCAN_DEVICE_TYPES);
export type ScanDeviceTypeDto = z.infer<typeof ScanDeviceTypeSchema>;

/**
 * Optional body of `POST /trace/:code/scan` (FR-TRC-06): the scanner's country (ISO 3166-1 alpha-2) and
 * device class. Never an IP address. Old clients send no body at all.
 */
export const RecordScanRequestSchema = z.object({
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullish(),
  deviceType: ScanDeviceTypeSchema.nullish(),
});
export type RecordScanRequest = z.infer<typeof RecordScanRequestSchema>;

/** Per-product scan statistics for the owning household (FR-TRC-06); the series is the last 30 days in Vietnam time. */
export const ProductScanStatsSchema = z.object({
  total: z.int().nonnegative(),
  last30Days: z.int().nonnegative(),
  daily: z.array(z.object({ date: IsoDateSchema, count: z.int().nonnegative() })),
  /** Last 30 days; scans recorded before country tracking are counted under `null`. */
  byCountry: z.array(z.object({ country: z.string().nullable(), count: z.int().positive() })),
  byDeviceType: z.array(
    z.object({ deviceType: ScanDeviceTypeSchema.nullable(), count: z.int().positive() }),
  ),
});
export type ProductScanStatsDto = z.infer<typeof ProductScanStatsSchema>;

const CURRENT_YEAR_LIMIT = 2100;
const YearSchema = z.int().min(1000, 'Năm không hợp lệ').max(CURRENT_YEAR_LIMIT);

const AltSchema = z.string().trim().min(3, 'Hãy mô tả điều nhìn thấy trong ảnh').max(300);

/**
 * A family history milestone as the household sends it (FR-ART-02). The list is shown in the order
 * sent after a stable sort by year, so the order of milestones within a year is the household's.
 */
export const TimelineEventSchema = z.object({
  year: YearSchema,
  title: z.string().trim().min(2, 'Hãy đặt tiêu đề').max(160),
  text: z.string().trim().max(1_000).default(''),
  /** Optional photo the household uploaded itself. */
  photo: z.object({ mediaId: IdSchema, alt: AltSchema }).nullable().optional(),
});

/** A milestone as read back: the photo with its processed URL (null while still processing). */
export const TimelineEventResponseSchema = z.object({
  year: z.int(),
  title: z.string(),
  text: z.string(),
  photo: z
    .object({
      mediaId: IdSchema,
      url: z.string().nullable(),
      variants: PublicImageVariantsSchema,
      alt: z.string(),
    })
    .nullable(),
});
export type TimelineEventDto = z.infer<typeof TimelineEventResponseSchema>;

/** A photo the household uploaded itself: the media asset and what it shows. */
const OwnPhotoInputSchema = z.object({ mediaId: IdSchema, alt: AltSchema });

/** A photo as read back: its processed URL (null while still processing) and every size. */
export const ProfilePhotoResponseSchema = z.object({
  mediaId: IdSchema,
  url: z.string().nullable(),
  variants: PublicImageVariantsSchema,
  alt: z.string(),
});
export type ProfilePhotoDto = z.infer<typeof ProfilePhotoResponseSchema>;

/**
 * A certification as the household sends it (FR-ART-03): name, issuer, issue date and an optional photo.
 * Legacy entries have only a year; when a date is given the stored year is derived from it.
 */
const CertificationInputSchema = z
  .object({
    name: z.string().trim().min(2, 'Hãy ghi tên chứng nhận').max(160),
    issuer: z.string().trim().min(2, 'Hãy ghi đơn vị cấp').max(160),
    year: YearSchema.optional(),
    issuedOn: IsoDateSchema.optional(),
    photo: OwnPhotoInputSchema.nullable().optional(),
  })
  .refine((c) => certificationYear(c) !== null, {
    message: 'Hãy nhập ngày cấp',
    path: ['issuedOn'],
  })
  .refine(
    (c) => {
      const year = certificationYear(c);
      return year === null || (year >= 1000 && year <= CURRENT_YEAR_LIMIT);
    },
    { message: 'Năm không hợp lệ', path: ['issuedOn'] },
  );

/** A certification as read back; `verified` is only ever set by the village board. */
export const CertificationResponseSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  year: z.int(),
  issuedOn: IsoDateSchema.nullable().default(null),
  photo: ProfilePhotoResponseSchema.nullable().default(null),
  verified: z.boolean(),
});
export type CertificationDto = z.infer<typeof CertificationResponseSchema>;

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
  /** A new public URL slug; the old one keeps answering with a permanent redirect (PLAN E5). */
  slug: SlugSchema.optional(),
  /** The story as a restricted Markdown subset (`parseStoryMarkdown` in `@vcraft/domain`). */
  history: z.string().trim().max(10_000).optional(),
  /** Free-text detail of the craft ("men lam"); the category below is the fixed-list choice. */
  craft: z.string().trim().max(160).optional(),
  craftCategory: z.enum(CRAFT_CATEGORIES).nullable().optional(),
  /** Own cover photo, portrait and personal seal (FR-ART-01); null removes one. Alt text is required for the first two. */
  coverPhoto: OwnPhotoInputSchema.nullable().optional(),
  portraitPhoto: OwnPhotoInputSchema.nullable().optional(),
  sealPhoto: z
    .object({ mediaId: IdSchema, alt: z.string().trim().max(300).default('') })
    .nullable()
    .optional(),
  village: z.string().trim().max(160).optional(),
  foundedYear: YearSchema.nullable().optional(),
  generations: z.int().min(1).max(50).nullable().optional(),
  timeline: z.array(TimelineEventSchema).max(50).optional(),
  certifications: z.array(CertificationInputSchema).max(30).optional(),
  gallery: z.array(GalleryInputSchema).max(30).optional(),
  capacityByCategory: CapacitySchema.optional(),
});
export type UpdateHouseholdProfileRequest = z.infer<typeof UpdateHouseholdProfileRequestSchema>;

/** `GET /households/slug-availability?slug=`: a live check while the household types its address (FR-ART-01). */
export const SlugAvailabilityQuerySchema = z.object({ slug: SlugSchema });
export type SlugAvailabilityQuery = z.infer<typeof SlugAvailabilityQuerySchema>;
export const SlugAvailabilityResponseSchema = z.object({
  available: z.boolean(),
  /** A free alternative, only when the asked slug is taken. */
  suggestion: SlugSchema.optional(),
});
export type SlugAvailabilityDto = z.infer<typeof SlugAvailabilityResponseSchema>;

/** `PUT /admin/households/:id/certifications/:index/verification`: the board marks a certification verified or not. */
export const SetCertificationVerificationRequestSchema = z.strictObject({ verified: z.boolean() });
export type SetCertificationVerificationRequest = z.infer<
  typeof SetCertificationVerificationRequestSchema
>;

/**
 * `POST /me/household/story-suggestion` (FR-ART-08): a suggested story in Vietnamese and its English
 * translation. Only a suggestion: the household copies it into the editor and saves it itself.
 */
export const StorySuggestionResponseSchema = z.object({ vi: z.string(), en: z.string() });
export type StorySuggestionDto = z.infer<typeof StorySuggestionResponseSchema>;

/** Experience offer of a workshop (FR-ART-05): what visitors can do, for how long and at what price. */
export const WorkshopExperienceSchema = z.object({
  description: z.string().trim().min(5, 'Hãy mô tả trải nghiệm').max(1_000),
  durationMinutes: z.int().min(5).max(1_440),
  priceVnd: z.int().min(0).max(100_000_000),
});
export type WorkshopExperienceDto = z.infer<typeof WorkshopExperienceSchema>;

export const CreateWorkshopRequestSchema = z
  .object({
    name: NameSchema,
    address: z.string().trim().min(5).max(300),
    purpose: WorkshopPurposeSchema.default('PRODUCTION'),
    acceptsVisitors: z.boolean().default(false),
    visitingInfo: z.string().trim().max(2_000).optional(),
    openingHours: z.array(OpeningIntervalSchema).max(21).optional(),
    /** Omitted or null: the workshop offers no experience. */
    experience: WorkshopExperienceSchema.nullish(),
    /** Temporarily closed (BR-03); needs a reason shown to visitors. */
    temporarilyClosed: z.boolean().default(false),
    closureReason: z.string().trim().max(300).optional(),
    /** Hamlet of the workshop. On update, left out keeps the stored area and null clears it. */
    areaCode: VillageAreaCodeSchema.nullish(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((w) => !w.temporarilyClosed || (w.closureReason ?? '').length > 0, {
    message: 'Hãy ghi lý do tạm đóng cửa',
    path: ['closureReason'],
  });
export type CreateWorkshopRequest = z.infer<typeof CreateWorkshopRequestSchema>;

export const CreateArtisanRequestSchema = z.object({
  name: NameSchema,
  craftRole: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2_000).optional(),
});
export type CreateArtisanRequest = z.infer<typeof CreateArtisanRequestSchema>;

/** Tối đa 12 ảnh mỗi sản phẩm (FR-PRD-02); mô tả ảnh bắt buộc. */
export const MAX_PRODUCT_IMAGES = 12;
const ProductImageInputSchema = z.object({ mediaId: IdSchema, alt: AltSchema });

/** FR-PRD-01: up to 10 tags of 1 to 30 characters; the server also drops case-insensitive duplicates. */
export const ProductTagsSchema = z
  .array(z.string().trim().min(1, 'Thẻ không được để trống').max(MAX_PRODUCT_TAG_LENGTH))
  .max(MAX_PRODUCT_TAGS);

export const CreateProductRequestSchema = z
  .object({
    name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(200),
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
    tags: ProductTagsSchema.optional(),
  })
  .refine((p) => (p.kind === 'BATCH') === (p.batchSize !== undefined), {
    message: 'Lô sản xuất cần số lượng vật trong lô; vật đơn chiếc thì không',
    path: ['batchSize'],
  });
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>;

/** Sửa sản phẩm: chỉ gửi phần đổi; loại và cỡ lô đi cùng nhau, `If-Match` bắt buộc. */
export const UpdateProductRequestSchema = z.object({
  name: z.string().trim().min(2, 'Tên cần ít nhất 2 ký tự').max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  category: CategorySchema.optional(),
  priceVnd: z.int().min(0).max(2_000_000_000).optional(),
  stock: z.int().min(0).max(1_000_000).optional(),
  material: z.string().trim().max(200).optional(),
  dimensions: z.string().trim().max(200).optional(),
  weightGrams: z.int().positive().max(1_000_000).nullable().optional(),
  artisanNote: z.string().trim().max(2_000).optional(),
  images: z.array(ProductImageInputSchema).max(MAX_PRODUCT_IMAGES).optional(),
  tags: ProductTagsSchema.optional(),
});
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>;

export const WithdrawProductRequestSchema = z.object({ reason: ReasonSchema });

/** `GET /me/household/products/price-suggestion?category=...` (FR-PRD-07). */
export const PriceSuggestionQuerySchema = z.object({ category: CategorySchema });
export type PriceSuggestionQuery = z.infer<typeof PriceSuggestionQuerySchema>;

/**
 * Median unit price of the published products in the category, with the number of products it is based
 * on; `suggestion` is null when fewer than 3 comparable products exist. It is only a hint: the price
 * is never filled in automatically.
 */
export const PriceSuggestionResponseSchema = z.object({
  category: CategorySchema,
  suggestion: z.object({ medianVnd: z.int().positive(), count: z.int().min(3) }).nullable(),
});
export type PriceSuggestionDto = z.infer<typeof PriceSuggestionResponseSchema>;

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
  /** Null when the workshop offers no experience. */
  experience: WorkshopExperienceSchema.nullable(),
  temporarilyClosed: z.boolean(),
  closureReason: z.string().nullable(),
  /** Hamlet the workshop is in; null when not set. */
  areaCode: VillageAreaCodeSchema.nullable(),
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
  /** Free-text tags (FR-PRD-01), at most 10, in the order the household wrote them. */
  tags: z.array(z.string()).default([]),
  coverUrl: z.string().nullable(),
  /** Sizes of the cover when it is an uploaded photo; empty for a preset cover. */
  coverVariants: PublicImageVariantsSchema,
  coverAlt: z.string().nullable(),
  /** English description of the cover for `/en`; null falls back to `coverAlt`. */
  coverAltEn: z.string().nullable().default(null),
  /** `url` trống khi ảnh còn chờ xử lý; trang công khai bỏ qua các ảnh đó. */
  images: z.array(
    z.object({
      mediaId: IdSchema,
      url: z.string().nullable(),
      variants: PublicImageVariantsSchema,
      /** ThumbHash (base64) of a processed photo, for a blurred placeholder; null while it is processing. */
      thumbhash: z.string().nullable().default(null),
      alt: z.string(),
    }),
  ),
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
  /** Free-text detail of the craft, as the household wrote it. */
  craft: z.string().nullable(),
  /** The stored category, or one inferred from legacy `craft` text; null when the household has neither. */
  craftCategory: z.enum(CRAFT_CATEGORIES).nullable().default(null),
  coverUrl: z.string().nullable(),
  /** Sizes of `coverUrl` when it is a processed media-store image; empty otherwise. */
  coverVariants: PublicImageVariantsSchema,
  /** Mean of the buyers' 1-5 star ratings with one decimal (FR-ORD-11); null until the first rating. */
  ratingAverage: z.number().min(1).max(5).nullable(),
  ratingCount: z.int().min(0),
  /** Portrait and banner linked through `media_link`. */
  portrait: PublicImageSchema.nullable(),
  banner: PublicImageSchema.nullable(),
  /** Personal seal or signature of the artisan, shown near the story. */
  seal: PublicImageSchema.nullable().default(null),
  foundedYear: z.int().nullable(),
  generations: z.int().nullable(),
  timeline: z.array(TimelineEventResponseSchema),
  certifications: z.array(CertificationResponseSchema),
  /**
   * Public: `media_link` images (by `position`), then the household's own. The private profile has only
   * the household's own, since a household may resubmit only its own media. `url` is null while an image
   * is still processing; public pages skip those.
   */
  gallery: z.array(
    z.object({
      mediaId: IdSchema.nullable(),
      url: z.string().nullable(),
      /** Empty for static demo photos, which exist at one size. */
      variants: PublicImageVariantsSchema,
      alt: z.string(),
      /** English description for `/en`; null falls back to `alt`. */
      altEn: z.string().nullable().default(null),
      caption: z.string().nullable(),
      credit: PublicCreditSchema,
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
  /** Derived review state (vCRAFT-8my.2); an active `statusReason` outranks the resubmission marker. */
  reviewState: HouseholdReviewStateSchema,
  resubmittedAt: IsoDateTimeSchema.nullable().default(null),
  approvedAt: IsoDateTimeSchema.nullable(),
  /** The household's own photos as saved, even while still processing (Studio editor; admin review). */
  coverPhoto: ProfilePhotoResponseSchema.nullable().default(null),
  portraitPhoto: ProfilePhotoResponseSchema.nullable().default(null),
  sealPhoto: ProfilePhotoResponseSchema.nullable().default(null),
  /** `••••••••1234`, or null when no citizen ID number is on record. Never the full number. */
  idNumberMasked: z.string().nullable(),
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
    /** Credit for `product.coverUrl`; null when the cover is a photo the household uploaded. */
    coverCredit: PublicCreditSchema,
    household: z.object({
      name: z.string(),
      slug: z.string(),
      /** Only APPROVED households are public, so a visible trace always carries APPROVED (FR-TRC-04). */
      status: HouseholdStatusSchema,
    }),
    journal: JournalResponseSchema,
    /** Số lượt quét mã QR của sản phẩm này. */
    scanCount: z.int().nonnegative(),
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
  /** Credit for `product.coverUrl`; null when the cover is a photo the household uploaded. */
  coverCredit: PublicCreditSchema,
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
  /** Visitable workshops only; null otherwise. */
  experience: WorkshopExperienceSchema.nullable(),
  /** BR-03: a temporarily closed workshop is shown as closed with this reason. */
  temporarilyClosed: z.boolean(),
  closureReason: z.string().nullable(),
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

/** At most 10 A4 sheets of 45 labels per request (PLAN E6). */
export const MAX_QR_LABELS = 450;

/** `POST /me/household/qr-labels`: print `copies` labels for each of the household's products. */
export const CreateQrLabelsRequestSchema = z
  .object({
    productIds: z.array(IdSchema).min(1).max(MAX_QR_LABELS),
    copies: z.int().min(1).max(45).default(1),
  })
  .refine((v) => v.productIds.length * v.copies <= MAX_QR_LABELS, {
    message: `Tối đa ${MAX_QR_LABELS} nhãn mỗi lần`,
    path: ['copies'],
  });
export type CreateQrLabelsRequest = z.input<typeof CreateQrLabelsRequestSchema>;

/** A label sheet being rendered by the worker; `url` (short-lived) once the PDF is ready. */
export const QrLabelsResponseSchema = z.object({
  requestId: IdSchema,
  status: z.enum(['PENDING', 'READY']),
  url: z.string().nullable(),
});
export type QrLabelsDto = z.infer<typeof QrLabelsResponseSchema>;
