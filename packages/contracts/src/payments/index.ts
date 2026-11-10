import {
  ONLINE_PAYMENT_METHODS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  UNAPPLIED_PAYMENT_REASONS,
  UNAPPLIED_PAYMENT_STATUSES,
} from '@vcraft/domain';
import { z } from 'zod';
import {
  CursorPageQuerySchema,
  cursorPageSchema,
  IdSchema,
  IsoDateTimeSchema,
  VersionSchema,
  VndSchema,
} from '../common';

/**
 * Online payment of orders (ADR-0021, GH#205). An order is an accepted quotation (identified by its quotation
 * request id); the buyer pays a deposit before production and the balance before delivery.
 */
export const PaymentKindSchema = z.enum(PAYMENT_KINDS);
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export const OnlinePaymentMethodSchema = z.enum(ONLINE_PAYMENT_METHODS);
export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);

/** `POST /orders/{id}/payments`: the buyer starts a payment. The amount is the server's, never the client's. */
export const CreatePaymentRequestSchema = z.strictObject({
  kind: PaymentKindSchema,
  method: OnlinePaymentMethodSchema,
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

/** What the buyer does to pay: transfer to an account (with a VietQR image) or go to the wallet's page. */
export const PaymentCheckoutSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('BANK_TRANSFER'),
    bankName: z.string(),
    accountNumber: z.string(),
    accountName: z.string(),
    /** The payment code the transfer content must carry, so the webhook can match the money. */
    transferContent: z.string(),
    /** A QR image of the same transfer, or `null` when no QR service is configured. */
    qrImageUrl: z.string().nullable(),
    /** The VietQR (EMVCo) string a client can encode itself; `null` when the bank BIN is not configured. */
    qrPayload: z.string().nullable(),
  }),
  z.strictObject({
    type: z.literal('REDIRECT'),
    url: z.string(),
    deeplink: z.string().nullable(),
    qrImageUrl: z.string().nullable(),
  }),
]);
export type PaymentCheckoutDto = z.infer<typeof PaymentCheckoutSchema>;

export const PaymentResponseSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  /** The order: its quotation request id. */
  orderId: IdSchema,
  kind: PaymentKindSchema,
  method: PaymentMethodSchema,
  provider: PaymentProviderSchema.nullable(),
  amountVnd: VndSchema,
  /** Goes into the transfer content, `vnp_TxnRef` or MoMo `orderId`; the buyer polls by it. */
  referenceCode: z.string(),
  status: PaymentStatusSchema,
  expiresAt: IsoDateTimeSchema.nullable(),
  paidAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  refundedAt: IsoDateTimeSchema.nullable(),
  refundReason: z.string().nullable(),
  /** The administrator's note on an offline payment. */
  note: z.string().nullable(),
  /** How to pay; present only while the payment is `PENDING`. */
  checkout: PaymentCheckoutSchema.nullable(),
  /** Set when the order was cancelled while this payment was paid: the money is owed back (GH#417). */
  refundDueAt: IsoDateTimeSchema.nullable().optional(),
});
export type PaymentDto = z.infer<typeof PaymentResponseSchema>;

/** `GET /orders/{id}/payments`: the order's money, its payments and the methods this deployment offers. */
export const OrderPaymentsResponseSchema = z.strictObject({
  orderId: IdSchema,
  totalVnd: VndSchema,
  depositPercent: z.int().min(1).max(99),
  depositAmountVnd: VndSchema,
  balanceAmountVnd: VndSchema,
  /** Production waits for a paid deposit in this deployment. */
  depositRequired: z.boolean(),
  depositPaidAt: IsoDateTimeSchema.nullable(),
  balancePaidAt: IsoDateTimeSchema.nullable(),
  /** Online methods the buyer may use: SePay when its account is configured, VNPay and MoMo when their mode is on. */
  methods: z.array(OnlinePaymentMethodSchema),
  /** The same methods in the same order, with what the buyer should know before choosing one. */
  methodOptions: z.array(
    z.strictObject({
      method: OnlinePaymentMethodSchema,
      /** The gateway runs in its provider's sandbox: no real money moves. Always `false` for SePay. */
      sandbox: z.boolean(),
      minAmountVnd: VndSchema,
      /** `null`: no upper limit. */
      maxAmountVnd: VndSchema.nullable(),
    }),
  ),
  /** The sandbox "simulate transfer" button is available (`APP_ENV` is not production). */
  simulateAvailable: z.boolean(),
  payments: z.array(PaymentResponseSchema),
});
export type OrderPaymentsDto = z.infer<typeof OrderPaymentsResponseSchema>;

/** `POST /admin/orders/{id}/payments/offline`: an administrator records a balance paid outside the site. */
export const RecordOfflinePaymentRequestSchema = z.strictObject({
  kind: z.literal('BALANCE').default('BALANCE'),
  /** How the money came in: cash, a transfer to another account, a receipt number. */
  note: z.string().trim().min(3, 'Ghi chú cần ít nhất 3 ký tự').max(500),
});
export type RecordOfflinePaymentRequest = z.infer<typeof RecordOfflinePaymentRequestSchema>;

/** `POST /admin/payments/{id}/refund`: marks a paid payment refunded. No gateway is called; money goes back by hand. */
export const RefundPaymentRequestSchema = z.strictObject({
  reason: z.string().trim().min(3, 'Lý do cần ít nhất 3 ký tự').max(500),
});
export type RefundPaymentRequest = z.infer<typeof RefundPaymentRequestSchema>;

/** `GET /admin/payments`: newest first. `refundDue=true` keeps paid payments of cancelled orders (GH#417). */
export const AdminPaymentListQuerySchema = CursorPageQuerySchema.extend({
  status: PaymentStatusSchema.optional(),
  method: PaymentMethodSchema.optional(),
  kind: PaymentKindSchema.optional(),
  refundDue: z.literal('true').optional(),
});
export type AdminPaymentListQuery = z.infer<typeof AdminPaymentListQuerySchema>;

export const AdminPaymentSchema = PaymentResponseSchema.extend({
  orderTitle: z.string().nullable(),
  buyerName: z.string(),
});
export type AdminPaymentDto = z.infer<typeof AdminPaymentSchema>;
export const AdminPaymentPageSchema = cursorPageSchema(AdminPaymentSchema);
export type AdminPaymentPageDto = z.infer<typeof AdminPaymentPageSchema>;

export const UnappliedPaymentReasonSchema = z.enum(UNAPPLIED_PAYMENT_REASONS);
export const UnappliedPaymentStatusSchema = z.enum(UNAPPLIED_PAYMENT_STATUSES);

/**
 * Money a provider reported that could not be applied (GH#417): one record per provider transaction, never
 * overwritten. The raw provider payload stays on the server.
 */
export const UnappliedPaymentSchema = z.strictObject({
  id: IdSchema,
  version: VersionSchema,
  paymentId: IdSchema.nullable(),
  orderId: IdSchema.nullable(),
  orderTitle: z.string().nullable(),
  provider: PaymentProviderSchema,
  providerTxnId: z.string(),
  referenceCode: z.string(),
  amountVnd: VndSchema,
  /** What the payment expected, for an amount mismatch. */
  expectedAmountVnd: VndSchema.nullable(),
  reason: UnappliedPaymentReasonSchema,
  status: UnappliedPaymentStatusSchema,
  receivedAt: IsoDateTimeSchema,
  resolvedAt: IsoDateTimeSchema.nullable(),
  resolution: z.string().nullable(),
});
export type UnappliedPaymentDto = z.infer<typeof UnappliedPaymentSchema>;

/** `GET /admin/payments/unapplied`: newest first; open ones by default. */
export const UnappliedPaymentListQuerySchema = CursorPageQuerySchema.extend({
  status: UnappliedPaymentStatusSchema.default('OPEN'),
});
export type UnappliedPaymentListQuery = z.infer<typeof UnappliedPaymentListQuerySchema>;
export const UnappliedPaymentPageSchema = cursorPageSchema(UnappliedPaymentSchema);
export type UnappliedPaymentPageDto = z.infer<typeof UnappliedPaymentPageSchema>;

/** `POST /admin/payments/unapplied/{id}/resolve`: how the money was handled (given back, applied by hand). */
export const ResolveUnappliedPaymentRequestSchema = z.strictObject({
  resolution: z.string().trim().min(3, 'Ghi chú cần ít nhất 3 ký tự').max(500),
});
export type ResolveUnappliedPaymentRequest = z.infer<typeof ResolveUnappliedPaymentRequestSchema>;

// --- Provider webhooks. Providers add fields over time, so each payload is read loosely. ---

/**
 * SePay bank-account webhook (docs.sepay.vn): one POST per incoming or outgoing transfer on a linked account.
 * `id` is SePay's transaction id, the idempotency key; `code` is the payment code SePay detected, if any.
 */
export const SepayWebhookPayloadSchema = z.looseObject({
  id: z.union([z.number(), z.string()]).transform(String),
  gateway: z.string().optional(),
  transactionDate: z.string().optional(),
  accountNumber: z.string().nullish(),
  code: z.string().nullish(),
  content: z.string().nullish(),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number(),
  accumulated: z.number().nullish(),
  subAccount: z.string().nullish(),
  referenceCode: z.string().nullish(),
  description: z.string().nullish(),
});
export type SepayWebhookPayload = z.infer<typeof SepayWebhookPayloadSchema>;

/** VNPay IPN and return query: every `vnp_*` field as a string, signed with `vnp_SecureHash`. */
export const VnpayCallbackQuerySchema = z.looseObject({
  vnp_TmnCode: z.string().optional(),
  vnp_Amount: z.string(),
  vnp_TxnRef: z.string(),
  vnp_TransactionNo: z.string().optional(),
  vnp_ResponseCode: z.string(),
  vnp_TransactionStatus: z.string().optional(),
  vnp_SecureHash: z.string(),
});
export type VnpayCallbackQuery = z.infer<typeof VnpayCallbackQuerySchema>;

/** MoMo IPN (and the redirect query, which carries the same fields): signed with HMAC-SHA256. */
export const MomoCallbackSchema = z.looseObject({
  partnerCode: z.string(),
  orderId: z.string(),
  requestId: z.string(),
  amount: z.coerce.number(),
  orderInfo: z.string().optional().default(''),
  orderType: z.string().optional().default(''),
  transId: z.union([z.number(), z.string()]).transform(String),
  resultCode: z.coerce.number(),
  message: z.string().optional().default(''),
  payType: z.string().optional().default(''),
  responseTime: z.union([z.number(), z.string()]).transform(String),
  extraData: z.string().optional().default(''),
  signature: z.string(),
});
export type MomoCallback = z.infer<typeof MomoCallbackSchema>;
