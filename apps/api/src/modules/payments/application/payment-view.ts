import type { PaymentDto, UnappliedPaymentDto } from '@vcraft/contracts';
import type { Payment, UnappliedPaymentEvent } from '@vcraft/database';

/** The wire shape of a payment. How to pay (`checkout`) is given only while the payment is still `PENDING`. */
export function toPaymentDto(payment: Payment): PaymentDto {
  return {
    id: payment.id,
    version: payment.version,
    orderId: payment.order.id,
    kind: payment.kind,
    method: payment.method,
    provider: payment.provider ?? null,
    amountVnd: payment.amountVnd,
    referenceCode: payment.referenceCode,
    status: payment.status,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    refundedAt: payment.refundedAt?.toISOString() ?? null,
    refundReason: payment.refundReason ?? null,
    refundNeededAt: payment.refundNeededAt?.toISOString() ?? null,
    note: payment.note ?? null,
    checkout: payment.status === 'PENDING' ? (payment.checkout ?? null) : null,
  };
}

/** The wire shape of an unapplied transfer, with the payment and order it named when they are known. */
export function toUnappliedDto(row: UnappliedPaymentEvent): UnappliedPaymentDto {
  return {
    id: row.id,
    version: row.version,
    provider: row.provider,
    providerTxnId: row.providerTxnId,
    amountVnd: row.amountVnd,
    reason: row.reason,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    referenceCode: row.payment?.referenceCode ?? null,
    expectedAmountVnd: row.payment?.amountVnd ?? null,
    orderId: row.order?.id ?? null,
    orderTitle: row.order?.title ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedNote: row.resolvedNote ?? null,
  };
}
