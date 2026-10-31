import { DELIVERY_TERMS, QUOTATION_NOTICE_KINDS } from '@vcraft/domain';
import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, VersionSchema, VndSchema } from '../common';
import { RfqResponseSchema } from './create-rfq';

const PositiveQuantitySchema = z
  .int()
  .min(1, 'Số lượng phải từ 1 trở lên')
  .max(2_147_483_647, 'Số lượng vượt giới hạn lưu trữ');
const PositiveVndSchema = VndSchema.min(1, 'Đơn giá phải lớn hơn 0');

export const QuotationNoticeResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  kind: z.enum(QUOTATION_NOTICE_KINDS),
  requestId: IdSchema,
  quotationId: IdSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  readAt: IsoDateTimeSchema.nullable(),
});
export type QuotationNoticeDto = z.infer<typeof QuotationNoticeResponseSchema>;

export const MarkAllNoticesReadResponseSchema = z.strictObject({
  updated: z.int().min(0),
});
export type MarkAllNoticesReadResponse = z.infer<typeof MarkAllNoticesReadResponseSchema>;

export const ContributionStatusSchema = z.enum(['ACTIVE', 'WITHDRAWN']);

/** Một đóng góp riêng của hộ cho đúng một yêu cầu báo giá. */
export const CreateContributionRequestSchema = z.strictObject({
  maxQuantity: PositiveQuantitySchema,
  unitPriceVnd: PositiveVndSchema,
  completionDate: IsoDateTimeSchema,
});
export type CreateContributionRequest = z.infer<typeof CreateContributionRequestSchema>;
export const UpdateContributionRequestSchema = CreateContributionRequestSchema;
export type UpdateContributionRequest = z.infer<typeof UpdateContributionRequestSchema>;

export const ContributionResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  householdId: IdSchema,
  maxQuantity: PositiveQuantitySchema,
  unitPriceVnd: PositiveVndSchema,
  completionDate: IsoDateTimeSchema,
  status: ContributionStatusSchema,
});
export type ContributionDto = z.infer<typeof ContributionResponseSchema>;

/**
 * `GET /me/invitations`: requests addressed to the household, with its own offer only.
 * Sealed bidding: nothing here reveals another household's offer or even who else was invited.
 */
export const MyInvitationSchema = z.strictObject({
  request: RfqResponseSchema,
  contribution: ContributionResponseSchema.nullable(),
  declined: z.boolean(),
});
export type MyInvitationDto = z.infer<typeof MyInvitationSchema>;
export const MyInvitationListSchema = z.array(MyInvitationSchema);

export const InviteHouseholdsRequestSchema = z.strictObject({
  householdIds: z.array(IdSchema).min(1).max(100),
});

/** Internal admin input. The household unit price is never part of the buyer response. */
export const CooperativeQuotationPartSchema = z.strictObject({
  householdId: IdSchema,
  quantity: PositiveQuantitySchema,
  unitPriceVnd: PositiveVndSchema,
  completionDate: IsoDateTimeSchema,
  contributionVersion: VersionSchema,
});
export type CooperativeQuotationPartRequest = z.infer<typeof CooperativeQuotationPartSchema>;

export const DeliveryTermsSchema = z.enum(DELIVERY_TERMS);

/** Admin submits a manual plan. The RFQ path supplies requested quantity and dates. */
export const CreateCooperativeQuotationRequestSchema = z.strictObject({
  parts: z.array(CooperativeQuotationPartSchema).min(1),
  additionalChargeVnd: VndSchema.default(0),
  deliveryTerms: DeliveryTermsSchema,
});
export type CreateCooperativeQuotationRequest = z.infer<
  typeof CreateCooperativeQuotationRequestSchema
>;

export const QuotationStatusSchema = z.enum([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'LAPSED',
]);

/** Buyer-safe projection. It intentionally has no unit price on any part. */
export const BuyerQuotationResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  status: QuotationStatusSchema,
  quantity: PositiveQuantitySchema,
  parts: z.array(
    z.strictObject({
      householdId: IdSchema,
      householdName: z.string(),
      quantity: PositiveQuantitySchema,
      completionDate: IsoDateTimeSchema,
    }),
  ),
  productionTotalVnd: VndSchema,
  additionalChargeVnd: VndSchema,
  totalVnd: VndSchema,
  deliveryTerms: DeliveryTermsSchema,
});
export type BuyerQuotationDto = z.infer<typeof BuyerQuotationResponseSchema>;

export const InternalQuotationResponseSchema = BuyerQuotationResponseSchema.extend({
  parts: z.array(CooperativeQuotationPartSchema.extend({ householdName: z.string() })),
});
export type InternalQuotationDto = z.infer<typeof InternalQuotationResponseSchema>;

export const CoordinationResponseSchema = z.strictObject({
  request: RfqResponseSchema,
  contributions: z.array(ContributionResponseSchema.extend({ householdName: z.string() })),
});
export type CoordinationDto = z.infer<typeof CoordinationResponseSchema>;

export const ContributionHistoryResponseSchema = z.array(
  z.strictObject({
    version: VersionSchema,
    maxQuantity: PositiveQuantitySchema,
    unitPriceVnd: PositiveVndSchema,
    completionDate: IsoDateTimeSchema,
    status: ContributionStatusSchema,
  }),
);
