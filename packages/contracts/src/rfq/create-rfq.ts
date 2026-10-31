import { PRODUCT_CATEGORIES, RFQ_STATUSES } from '@vcraft/domain';
import { z } from 'zod';
import { CursorPageQuerySchema, cursorPageSchema } from '../common/pagination';
import { IdSchema, IsoDateTimeSchema, VersionSchema, VndSchema } from '../common/primitives';

/** GH#9: tạo yêu cầu báo giá — design, số lượng, đơn vị, điểm đến, ngày cần hàng, hạn chào giá. */
export const CreateRfqRequestSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200).optional(),
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    budgetMinVnd: VndSchema.optional(),
    budgetMaxVnd: VndSchema.optional(),
    design: z.string().trim().min(1, 'Thiếu mô tả mẫu sản phẩm').max(500),
    quantity: z.int().min(1, 'Số lượng phải từ 1 trở lên').max(2_147_483_647),
    unit: z.string().trim().min(1, 'Thiếu đơn vị tính').max(30),
    destination: z.string().trim().min(1, 'Thiếu nơi nhận hàng').max(300),
    requiredBy: IsoDateTimeSchema,
    biddingClosesAt: IsoDateTimeSchema,
    invitedHouseholdIds: z.array(IdSchema).default([]),
    coordinationOptIn: z.boolean().default(false),
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
  .refine((v) => v.invitedHouseholdIds.length > 0 || v.coordinationOptIn, {
    message: 'Chọn ít nhất một hộ được mời hoặc nhờ BQL điều phối',
    path: ['invitedHouseholdIds'],
  });
export type CreateRfqRequest = z.infer<typeof CreateRfqRequestSchema>;

/** Sua yeu cau khi còn DRAFT. Phiên bản kỳ vọng nằm ở header `If-Match` (BR-L1), không nằm trong body. */
export const UpdateRfqRequestSchema = CreateRfqRequestSchema;
export type UpdateRfqRequest = z.infer<typeof UpdateRfqRequestSchema>;

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
  quantity: z.int().min(1),
  unit: z.string(),
  destination: z.string(),
  requiredBy: IsoDateTimeSchema,
  biddingClosesAt: IsoDateTimeSchema,
  invitedHouseholdIds: z.array(IdSchema),
  coordinationOptIn: z.boolean(),
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
