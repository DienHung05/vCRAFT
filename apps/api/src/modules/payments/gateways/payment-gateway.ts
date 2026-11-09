import type { PaymentCheckoutData } from '@vcraft/database';
import type { PaymentKind, PaymentProvider } from '@vcraft/domain';

/** What a gateway needs to start a payment. */
export interface PaymentSnapshot {
  id: string;
  referenceCode: string;
  kind: PaymentKind;
  amountVnd: number;
  expiresAt: Date;
  /** Shown to the buyer on the provider's page. */
  description: string;
  clientIp: string;
}

/** A provider event whose signature or credentials were verified, reduced to what reconciliation needs. */
export interface VerifiedPaymentEvent {
  provider: PaymentProvider;
  /** The payment code found in the transfer content, `vnp_TxnRef` or MoMo `orderId`. */
  referenceCode: string;
  /** The provider's own transaction id: the idempotency key of the event. */
  providerTxnId: string;
  amountVnd: number;
  /** The provider says the money arrived (`PAID`) or the attempt failed (`FAILED`). */
  outcome: 'PAID' | 'FAILED';
  /** The event as received, stored on the payment for diagnosis. */
  raw: Record<string, unknown>;
}

export type WebhookVerdict =
  | { signatureValid: false; reason: string }
  | { signatureValid: true; event: VerifiedPaymentEvent }
  /**
   * A valid call that carries nothing to apply (an outgoing transfer, content without a payment code, a wallet
   * payment still in progress). `referenceCode` is set when the call still names a payment, so the browser
   * return can find its status page.
   */
  | { signatureValid: true; event: null; ignored: string; referenceCode?: string };

/** What a gateway needs to ask the provider for the state of a payment it started. */
export interface PaymentStatusQuery {
  referenceCode: string;
  amountVnd: number;
  createdAt: Date;
  /** The checkout the buyer was given, when it was stored (VNPay's query needs the original create date from it). */
  checkout: PaymentCheckoutData | null;
}

/**
 * The provider's answer to a status query. `PAID` and `FAILED` carry the event to reconcile (same transaction
 * id as the IPN would carry, so the two stay idempotent); `PENDING` (buyer has not finished) and `UNKNOWN`
 * (no usable answer) change nothing.
 */
export type ProviderStatus =
  | { state: 'PAID' | 'FAILED'; event: VerifiedPaymentEvent }
  | { state: 'PENDING' | 'UNKNOWN'; detail: string };

/**
 * One payment provider (ADR-0021). `createCheckout` says how the buyer pays; `verifyCallback` checks a
 * webhook, IPN or return call's credentials or signature and reduces it to a {@link VerifiedPaymentEvent}.
 * Nothing here changes a payment: only `PaymentsService.reconcile` does.
 */
export interface PaymentGateway<Input> {
  readonly provider: PaymentProvider;
  isConfigured(): boolean;
  createCheckout(payment: PaymentSnapshot): Promise<PaymentCheckoutData>;
  verifyCallback(input: Input): WebhookVerdict;
  /**
   * Asks the provider what became of a payment (a missed IPN, ADR-0024). Absent for SePay: a bank transfer is
   * only ever reported by the bank webhook. Never throws for a provider that is down: answers `UNKNOWN`.
   */
  queryStatus?(payment: PaymentStatusQuery): Promise<ProviderStatus>;
}

/** The HTTP client the VNPay and MoMo adapters call out with, replaceable in tests so no real endpoint is reached. */
export type PaymentHttp = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export const PAYMENT_HTTP = Symbol('PAYMENT_HTTP');
