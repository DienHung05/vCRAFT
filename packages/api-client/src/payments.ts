import {
  type AdminPaymentListQuery,
  AdminPaymentPageSchema,
  type CreatePaymentRequest,
  CreatePaymentRequestSchema,
  IdSchema,
  OrderPaymentsResponseSchema,
  PaymentResponseSchema,
  type RecordOfflinePaymentRequest,
  RecordOfflinePaymentRequestSchema,
  type RefundPaymentRequest,
  RefundPaymentRequestSchema,
  type ResolveUnappliedPaymentRequest,
  ResolveUnappliedPaymentRequestSchema,
  type UnappliedPaymentListQuery,
  UnappliedPaymentPageSchema,
  UnappliedPaymentSchema,
} from '@vcraft/contracts';
import {
  type ActionOptions,
  type AuthedClientOptions,
  createAuthedRequest,
  newIdempotencyKey,
} from './http/authed-request';

/**
 * Online payment of orders (ADR-0021): the buyer's panel and status page, and the village administration's
 * payments screens. The amount is never sent: the server prices every payment.
 */
export function createPaymentClient(options: AuthedClientOptions) {
  const request = createAuthedRequest(options);
  return {
    /** The order's money, its payments and the methods on offer (buyer of the order, or an administrator). */
    orderPayments: (orderId: string) =>
      request(`/orders/${IdSchema.parse(orderId)}/payments`, OrderPaymentsResponseSchema),
    createPayment: (orderId: string, body: CreatePaymentRequest, action: ActionOptions = {}) =>
      request(`/orders/${IdSchema.parse(orderId)}/payments`, PaymentResponseSchema, {
        method: 'POST',
        body: CreatePaymentRequestSchema.parse(body),
        idempotencyKey: action.idempotencyKey ?? newIdempotencyKey(),
      }),
    /** What the status page polls until the payment reaches a final state. */
    getPayment: (referenceCode: string) =>
      request(`/payments/${encodeURIComponent(referenceCode)}`, PaymentResponseSchema),
    cancelPayment: (referenceCode: string) =>
      request(`/payments/${encodeURIComponent(referenceCode)}/cancel`, PaymentResponseSchema, {
        method: 'POST',
      }),
    // --- administration ---
    adminPayments: (filters: Partial<AdminPaymentListQuery> = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== '') query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/payments${suffix}`, AdminPaymentPageSchema);
    },
    recordOfflinePayment: (
      orderId: string,
      body: RecordOfflinePaymentRequest,
      action: ActionOptions = {},
    ) =>
      request(`/admin/orders/${IdSchema.parse(orderId)}/payments/offline`, PaymentResponseSchema, {
        method: 'POST',
        body: RecordOfflinePaymentRequestSchema.parse(body),
        idempotencyKey: action.idempotencyKey ?? newIdempotencyKey(),
      }),
    refundPayment: (paymentId: string, version: number, body: RefundPaymentRequest) =>
      request(`/admin/payments/${IdSchema.parse(paymentId)}/refund`, PaymentResponseSchema, {
        method: 'POST',
        version,
        body: RefundPaymentRequestSchema.parse(body),
      }),
    /** Money that came in but could not be applied (GH#417); open records unless `status` says otherwise. */
    unappliedPayments: (filters: Partial<UnappliedPaymentListQuery> = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== '') query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/payments/unapplied${suffix}`, UnappliedPaymentPageSchema);
    },
    resolveUnappliedPayment: (id: string, version: number, body: ResolveUnappliedPaymentRequest) =>
      request(`/admin/payments/unapplied/${IdSchema.parse(id)}/resolve`, UnappliedPaymentSchema, {
        method: 'POST',
        version,
        body: ResolveUnappliedPaymentRequestSchema.parse(body),
      }),
    /** Sandbox only: transfers the exact amount of a pending SePay payment. */
    simulateTransfer: (paymentId: string) =>
      request(
        `/admin/payments/${IdSchema.parse(paymentId)}/simulate-transfer`,
        PaymentResponseSchema,
        {
          method: 'POST',
        },
      ),
  };
}

export type PaymentClient = ReturnType<typeof createPaymentClient>;
