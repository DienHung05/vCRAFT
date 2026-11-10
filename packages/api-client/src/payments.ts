import {
  type AdminPaymentListQuery,
  AdminPaymentPageSchema,
  type CreatePaymentRequest,
  CreatePaymentRequestSchema,
  type DemoConfirmRequest,
  DemoConfirmRequestSchema,
  DemoPaymentViewSchema,
  IdSchema,
  OrderPaymentsResponseSchema,
  PaymentResponseSchema,
  ProblemDetailsSchema,
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
  ApiError,
  type AuthedClientOptions,
  createAuthedRequest,
  newIdempotencyKey,
} from './http/authed-request';
import { fallbackErrorCode } from './http/fallback-error-code';

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

export interface DemoPaymentClientOptions {
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  signal?: AbortSignal;
}

/**
 * The confirm page of demo payment mode (ADR-0025), reached by scanning a QR with a phone. Public and anonymous:
 * no session, no `Authorization` header; the per-payment secret from the link is the credential. Errors are
 * {@link ApiError}s like every other client; an unknown link, a wrong secret and demo mode being off are all 404.
 */
export function createDemoPaymentClient(options: DemoPaymentClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const response = await fetcher(`/api/v1${path}`, {
      method: init.method ?? 'GET',
      cache: 'no-store',
      ...(options.signal ? { signal: options.signal } : {}),
      headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : {},
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(fallbackErrorCode(response.status), response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw new ApiError(
        problem.success ? problem.data.code : fallbackErrorCode(response.status),
        response.status,
        problem.success ? problem.data.errors : [],
      );
    }
    try {
      return schema.parse(data);
    } catch {
      throw new ApiError('INTERNAL_ERROR', response.status);
    }
  }
  return {
    /** The payment behind a QR: only what the confirm page shows, no buyer or order details. */
    view: (referenceCode: string, token: string) =>
      request(
        `/payments/demo/${encodeURIComponent(referenceCode)}?k=${encodeURIComponent(token)}`,
        DemoPaymentViewSchema,
      ),
    /** Confirms (`PAID`) or declines (`FAILED`) the rehearsal payment; repeating it answers the current state. */
    confirm: (referenceCode: string, body: DemoConfirmRequest) =>
      request(
        `/payments/demo/${encodeURIComponent(referenceCode)}/confirm`,
        DemoPaymentViewSchema,
        {
          method: 'POST',
          body: DemoConfirmRequestSchema.parse(body),
        },
      ),
  };
}

export type DemoPaymentClient = ReturnType<typeof createDemoPaymentClient>;
