import { ALLOCATION_STATUSES } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, VersionSchema } from '../common';

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
});
export type AllocationDto = z.infer<typeof AllocationResponseSchema>;
