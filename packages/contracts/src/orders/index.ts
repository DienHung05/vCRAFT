import { ALLOCATION_STATUSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, VersionSchema } from '../common';
import { RfqStatusSchema } from '../rfq/create-rfq';

/** GH#11: buyer chốt chào giá. Phiên bản kỳ vọng ở header `If-Match`, body chỉ mang quotation được chọn. */
export const AcceptQuotationRequestSchema = z.strictObject({
  quotationId: IdSchema,
});
export type AcceptQuotationRequest = z.infer<typeof AcceptQuotationRequestSchema>;

/** GH#11: admin hủy đơn sau sản xuất. Lý do bắt buộc (guard T6/T7 reasonProvided). */
export const CancelOrderRequestSchema = z.strictObject({
  reason: z.string().trim().min(1, 'Hãy ghi lý do').max(500),
});
export type CancelOrderRequest = z.infer<typeof CancelOrderRequestSchema>;

const AllocationQuantitySchema = z
  .int()
  .min(1, 'Số lượng phải từ 1 trở lên')
  .max(2_147_483_647, 'Số lượng vượt giới hạn lưu trữ');
const CompletedQuantitySchema = z
  .int()
  .min(0, 'Số lượng đã xong không được âm')
  .max(2_147_483_647, 'Số lượng vượt giới hạn lưu trữ');

/** Hộ báo cáo tiến độ theo phân bổ: số lượng đã xong từ 0 tới số lượng được giao. */
export const ReportProgressRequestSchema = z.strictObject({
  completedQty: CompletedQuantitySchema,
  note: z.string().trim().min(1).max(500).optional(),
  /** A processed public image the representative uploaded with purpose `JOURNAL`. */
  photoMediaId: IdSchema.optional(),
});
export type ReportProgressRequest = z.infer<typeof ReportProgressRequestSchema>;

export const AllocationStatusSchema = z.enum(ALLOCATION_STATUSES);

/** Một phân bổ trong đơn đã chốt: số lượng được giao và số lượng đã xong. */
export const AllocationResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  householdId: IdSchema,
  quantity: AllocationQuantitySchema,
  completedQty: CompletedQuantitySchema,
  status: AllocationStatusSchema,
  progressLog: z.array(
    z.strictObject({
      at: IsoDateTimeSchema,
      completedQty: CompletedQuantitySchema,
      note: z.string().nullable(),
      photoUrl: z.string().nullable(),
    }),
  ),
});
export type AllocationDto = z.infer<typeof AllocationResponseSchema>;

/** `GET /me/allocations`: the household's own shares across orders. */
export const MyAllocationSchema = AllocationResponseSchema.extend({
  requestId: IdSchema,
  requestTitle: z.string(),
  requestStatus: RfqStatusSchema,
  unit: z.string(),
  requiredBy: IsoDateTimeSchema,
  /** The date this household promised for its share. */
  completionDate: IsoDateTimeSchema.nullable(),
});
export type MyAllocationDto = z.infer<typeof MyAllocationSchema>;
export const MyAllocationListSchema = z.array(MyAllocationSchema);
