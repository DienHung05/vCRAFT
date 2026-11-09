import { createHash, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SepayWebhookPayloadSchema } from '@vcraft/contracts';
import type { PaymentCheckoutData } from '@vcraft/database';
import { buildVietQrPayload, extractReferenceCode } from '@vcraft/domain';
import { paymentsConfig } from '../payments.config';
import type { PaymentGateway, PaymentSnapshot, WebhookVerdict } from './payment-gateway';

export interface SepayCallback {
  /** The `Authorization` header: `Apikey <SEPAY_WEBHOOK_API_KEY>` (SePay webhook docs). */
  authorization: string | undefined;
  body: unknown;
}

/** Constant-time comparison that does not leak the length of the secret. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * SePay bank-account webhooks (ADR-0021). The money goes to the village administration's own account; SePay
 * posts each incoming transfer. There is nothing to call at checkout: the buyer gets the account, the amount
 * and the payment code (the transfer content), plus a VietQR image of the same transfer.
 */
@Injectable()
export class SepayGateway implements PaymentGateway<SepayCallback> {
  readonly provider = 'SEPAY' as const;

  isConfigured(): boolean {
    return paymentsConfig().sepay !== null;
  }

  async createCheckout(payment: PaymentSnapshot): Promise<PaymentCheckoutData> {
    const sepay = paymentsConfig().sepay;
    if (!sepay) throw new Error('SePay is not configured');
    const qrImageUrl = sepay.bankCode
      ? `${sepay.qrBaseUrl}?${new URLSearchParams({
          acc: sepay.accountNumber,
          bank: sepay.bankCode,
          amount: String(payment.amountVnd),
          des: payment.referenceCode,
        })}`
      : null;
    const qrPayload = sepay.bankBin
      ? buildVietQrPayload({
          bankBin: sepay.bankBin,
          accountNumber: sepay.accountNumber,
          amountVnd: payment.amountVnd,
          content: payment.referenceCode,
        })
      : null;
    return {
      type: 'BANK_TRANSFER',
      bankName: sepay.bankName,
      accountNumber: sepay.accountNumber,
      accountName: sepay.accountName,
      transferContent: payment.referenceCode,
      qrImageUrl,
      qrPayload,
    };
  }

  verifyCallback(input: SepayCallback): WebhookVerdict {
    const sepay = paymentsConfig().sepay;
    if (!sepay) return { signatureValid: false, reason: 'SEPAY_NOT_CONFIGURED' };
    const match = /^Apikey\s+(.+)$/i.exec(input.authorization?.trim() ?? '');
    if (!match?.[1] || !sameSecret(match[1].trim(), sepay.webhookApiKey)) {
      return { signatureValid: false, reason: 'BAD_API_KEY' };
    }
    const parsed = SepayWebhookPayloadSchema.safeParse(input.body);
    if (!parsed.success) return { signatureValid: true, event: null, ignored: 'MALFORMED_PAYLOAD' };
    const payload = parsed.data;
    if (payload.transferType !== 'in') {
      return { signatureValid: true, event: null, ignored: 'OUTGOING_TRANSFER' };
    }
    if (payload.accountNumber && payload.accountNumber !== sepay.accountNumber) {
      return { signatureValid: true, event: null, ignored: 'OTHER_ACCOUNT' };
    }
    const referenceCode =
      extractReferenceCode(payload.code) ?? extractReferenceCode(payload.content);
    if (!referenceCode) return { signatureValid: true, event: null, ignored: 'NO_PAYMENT_CODE' };
    return {
      signatureValid: true,
      event: {
        provider: 'SEPAY',
        referenceCode,
        providerTxnId: payload.id,
        amountVnd: payload.transferAmount,
        outcome: 'PAID',
        raw: payload,
      },
    };
  }
}
