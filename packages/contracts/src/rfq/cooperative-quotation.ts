import {
  BID_TYPES,
  DELIVERY_TERMS,
  PRODUCT_CATEGORIES,
  QUOTATION_NOTICE_KINDS,
} from '@vcraft/domain';
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
 * `GET /rfqs/{id}/price-hint`: a suggested unit price range for the household writing an offer, from
 * its own past offers and comparable public products only (PLAN E9). `hint` is null with no data.
 */
export const PriceHintResponseSchema = z.object({
  hint: z
    .object({
      minVnd: VndSchema,
      maxVnd: VndSchema,
      basis: z.enum(['OWN', 'CATALOG', 'MIXED']),
      ownSamples: z.int().nonnegative(),
      catalogSamples: z.int().nonnegative(),
    })
    .nullable(),
});
export type PriceHintDto = z.infer<typeof PriceHintResponseSchema>;

/**
 * A household quotes the whole quantity of a request without coordination (FR-RFQ-04): one unit price, the
 * date it can finish, and an optional note. The quantity, total and delivery terms come from the request.
 */
export const CreateDirectQuotationRequestSchema = z.strictObject({
  unitPriceVnd: PositiveVndSchema,
  completionDate: IsoDateTimeSchema,
  note: z.string().trim().max(500).optional(),
});
export type CreateDirectQuotationRequest = z.infer<typeof CreateDirectQuotationRequestSchema>;
export const UpdateDirectQuotationRequestSchema = CreateDirectQuotationRequestSchema;
export type UpdateDirectQuotationRequest = z.infer<typeof UpdateDirectQuotationRequestSchema>;

export const QuotationStatusSchema = z.enum([
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'LAPSED',
]);

/**
 * A household's own direct quotation, as that household reads it. A quotation written before GH#445
 * can hold no parts: its unit price and completion date are then `null` rather than the invalid
 * sentinels `0` and `''` that the strict response would reject. `totalVnd` is always stored.
 */
export const DirectQuotationResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  status: QuotationStatusSchema,
  quantity: PositiveQuantitySchema,
  unitPriceVnd: PositiveVndSchema.nullable(),
  totalVnd: VndSchema,
  completionDate: IsoDateTimeSchema.nullable(),
  note: z.string().nullable(),
});
export type DirectQuotationDto = z.infer<typeof DirectQuotationResponseSchema>;

/**
 * `GET /me/invitations`: requests addressed to the household, with its own offer only.
 * Sealed bidding: nothing here reveals another household's offer or even who else was invited.
 */
export const MyInvitationSchema = z.strictObject({
  request: RfqResponseSchema,
  contribution: ContributionResponseSchema.nullable(),
  declined: z.boolean(),
  /** The household's latest direct quotation on a request without coordination. */
  directQuotation: DirectQuotationResponseSchema.nullable().optional(),
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

/**
 * Buyer-safe projection. A cooperative quotation has no unit price on any part: the household rates stay
 * private. A direct (`INDIVIDUAL`) quotation is the household's own bid to the buyer, so its single part
 * carries the unit price the buyer compares.
 */
export const BuyerQuotationResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  status: QuotationStatusSchema,
  /** Absent on responses from an API that only knew cooperative quotations. */
  bidType: z.enum(BID_TYPES).optional(),
  note: z.string().nullable().optional(),
  quantity: PositiveQuantitySchema,
  parts: z.array(
    z.strictObject({
      householdId: IdSchema,
      householdName: z.string(),
      quantity: PositiveQuantitySchema,
      completionDate: IsoDateTimeSchema,
      unitPriceVnd: PositiveVndSchema.optional(),
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
  contributions: z.array(
    ContributionResponseSchema.extend({
      householdName: z.string(),
      /**
       * The capacity the household declared for the request's category (FR-ART-06). Absent or null when
       * it declared none; the split board caps a share at it (BR-L6).
       */
      householdCapacity: z.number().int().min(0).nullable().optional(),
    }),
  ),
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

/**
 * `GET /me/open-coordinated-requests` (BR-05a, ADR-0026): a redacted summary of a coordinated request an
 * administrator claimed and that is still open for offers. It carries no title, description, buyer
 * identity, budget, destination or attachments: those stay behind the invitation check.
 */
export const OpenCoordinatedRequestSchema = z.strictObject({
  id: IdSchema,
  category: z.enum(PRODUCT_CATEGORIES),
  quantity: PositiveQuantitySchema,
  unit: z.string(),
  biddingClosesAt: IsoDateTimeSchema,
  requiredBy: IsoDateTimeSchema,
});
export type OpenCoordinatedRequestDto = z.infer<typeof OpenCoordinatedRequestSchema>;
export const OpenCoordinatedRequestListSchema = z.array(OpenCoordinatedRequestSchema);
