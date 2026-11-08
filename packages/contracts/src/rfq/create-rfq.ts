import { PRODUCT_CATEGORIES, RFQ_STATUSES } from '@vcraft/domain';
import { z } from 'zod';
import { CursorPageQuerySchema, cursorPageSchema } from '../common/pagination';
import {
  IdSchema,
  IsoDateTimeSchema,
  VersionSchema,
  VietnamPhoneSchema,
  VndSchema,
} from '../common/primitives';
import { HouseholdRatingSchema } from './household-rating';

/** FR-RFQ-01: up to three attachments (a logo, a drawing) per request. */
export const RFQ_MAX_ATTACHMENTS = 3;
export const RFQ_MAX_CUSTOM_REQUIREMENTS = 1000;

export const ON_BEHALF_NAME_MAX = 120;

/**
 * FR-ORD-10 (GH#248 s5-10): the off-platform customer an administrator creates a request for. The customer
 * has no account; the administrator is the buyer of record and the coordinator, and reaches the customer by
 * phone. Only administrators read it back.
 */
export const OnBehalfOfSchema = z.strictObject({
  name: z.string().trim().min(1, 'Thiếu tên khách hàng').max(ON_BEHALF_NAME_MAX),
  phone: VietnamPhoneSchema,
  email: z.email().max(254).optional(),
});
export type OnBehalfOfDto = z.infer<typeof OnBehalfOfSchema>;

/** GH#9: tạo yêu cầu báo giá — design, số lượng, đơn vị, điểm đến, ngày cần hàng, hạn chào giá. */
export const CreateRfqRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    budgetMinVnd: VndSchema.optional(),
    budgetMaxVnd: VndSchema.optional(),
    design: z.string().trim().min(1, 'Thiếu mô tả mẫu sản phẩm').max(500),
    /** Special requests such as logo printing (FR-RFQ-01). */
    customRequirements: z.string().trim().max(RFQ_MAX_CUSTOM_REQUIREMENTS).optional(),
    /** Ids of the buyer's own `RFQ_ATTACHMENT` uploads (`POST /media?purpose=RFQ_ATTACHMENT`). */
    attachments: z
      .array(IdSchema)
      .max(RFQ_MAX_ATTACHMENTS, 'Attach at most 3 files')
      .refine((ids) => new Set(ids).size === ids.length, 'Attachments must be distinct')
      .default([]),
    quantity: z.int().min(1, 'Số lượng phải từ 1 trở lên').max(2_147_483_647),
    unit: z.string().trim().min(1, 'Thiếu đơn vị tính').max(30),
    destination: z.string().trim().min(1, 'Thiếu nơi nhận hàng').max(300),
    requiredBy: IsoDateTimeSchema,
    biddingClosesAt: IsoDateTimeSchema,
    invitedHouseholdIds: z.array(IdSchema).default([]),
    coordinationOptIn: z.boolean().default(false),
    /** Required from an administrator, refused from a buyer (checked by the API against the caller's role). */
    onBehalfOf: OnBehalfOfSchema.optional(),
  })
  .refine((v) => new Date(v.requiredBy).getTime() > new Date(v.biddingClosesAt).getTime(), {
    message: 'Ngày cần hàng phải sau hạn chào giá',
    path: ['requiredBy'],
  })
  .refine(
    (v) =>
      v.budgetMinVnd === undefined ||
      v.budgetMaxVnd === undefined ||
      v.budgetMinVnd <= v.budgetMaxVnd,
    { message: 'Ngân sách tối thiểu không được lớn hơn tối đa', path: ['budgetMinVnd'] },
  )
  // BR-05: with no chosen household and no coordination the system picks households of the craft category.
  .refine(
    (v) => v.invitedHouseholdIds.length > 0 || v.coordinationOptIn || v.category !== undefined,
    {
      message: 'Choose a category for matching, invite households or ask the board to coordinate',
      path: ['category'],
    },
  );
export type CreateRfqRequest = z.infer<typeof CreateRfqRequestSchema>;

/** Sua yeu cau khi còn DRAFT. Phiên bản kỳ vọng nằm ở header `If-Match` (BR-L1), không nằm trong body. */
export const UpdateRfqRequestSchema = CreateRfqRequestSchema;
export type UpdateRfqRequest = z.infer<typeof UpdateRfqRequestSchema>;

/** A file attached to a request. Private: read through `GET /media/{id}/read-url`. */
export const RfqAttachmentSchema = z.strictObject({
  id: IdSchema,
  mimeType: z.string(),
  sizeBytes: z.int().nonnegative(),
});
export type RfqAttachmentDto = z.infer<typeof RfqAttachmentSchema>;

/** Response luôn có id + version + revision (BR-L1, lịch sử phiên bản). */
export const RfqStatusSchema = z.enum(RFQ_STATUSES);
export const RfqResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  revision: z.int().min(0),
  status: RfqStatusSchema,
  /** Falls back to the description on requests that have no title. */
  title: z.string(),
  category: z.enum(PRODUCT_CATEGORIES).nullable(),
  budgetMinVnd: VndSchema.nullable(),
  budgetMaxVnd: VndSchema.nullable(),
  cancelReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  design: z.string(),
  /** Absent on responses from an API older than FR-RFQ-01 custom requirements. */
  customRequirements: z.string().nullable().optional(),
  attachments: z.array(RfqAttachmentSchema).optional(),
  quantity: z.int().min(1),
  unit: z.string(),
  destination: z.string(),
  requiredBy: IsoDateTimeSchema,
  biddingClosesAt: IsoDateTimeSchema,
  invitedHouseholdIds: z.array(IdSchema),
  coordinationOptIn: z.boolean(),
  /** Set only on a household representative's read of a request it was invited to. */
  declinedByMe: z.boolean().optional(),
  /** Whether the request ever received a complete quotation, for its shared stage display. */
  hasBids: z.boolean().optional(),
  /** The off-platform customer of a request an administrator made (FR-ORD-10); only administrators see it. */
  onBehalfOf: OnBehalfOfSchema.nullable().optional(),
  /** The owner's ratings of the households of a delivered request (FR-ORD-11); only the owner sees them. */
  ratings: z.array(HouseholdRatingSchema).optional(),
});
export type RfqResponse = z.infer<typeof RfqResponseSchema>;

/** `GET /rfqs`: the signed-in buyer's requests, newest first. */
export const ListRfqsQuerySchema = CursorPageQuerySchema.extend({
  status: RfqStatusSchema.optional(),
});
export type ListRfqsQuery = z.infer<typeof ListRfqsQuerySchema>;

export const RfqListItemSchema = RfqResponseSchema.extend({
  /** Quotations the buyer can currently act on. */
  openQuotationCount: z.int().min(0),
});
export type RfqListItemDto = z.infer<typeof RfqListItemSchema>;
export const RfqListResponseSchema = cursorPageSchema(RfqListItemSchema);
export type RfqListDto = z.infer<typeof RfqListResponseSchema>;

/** Buyer chốt chào giá. Phiên bản kỳ vọng nằm ở header `If-Match` (BR-L1); body chỉ mang bid được chọn. */
export const AcceptBidRequestSchema = z.strictObject({
  bidId: IdSchema,
});
export type AcceptBidRequest = z.infer<typeof AcceptBidRequestSchema>;
