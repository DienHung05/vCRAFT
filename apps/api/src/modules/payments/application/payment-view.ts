import type { PaymentDto } from '@vcraft/contracts';
import type { Payment } from '@vcraft/database';

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
    note: payment.note ?? null,
    checkout: payment.status === 'PENDING' ? (payment.checkout ?? null) : null,
  };
}
