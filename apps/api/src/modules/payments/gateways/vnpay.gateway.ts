import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { VnpayCallbackQuerySchema } from '@vcraft/contracts';
import type { PaymentCheckoutData } from '@vcraft/database';
import { paymentsConfig } from '../payments.config';
import type { PaymentGateway, PaymentSnapshot, WebhookVerdict } from './payment-gateway';

/** VNPay v2.1.0 signs the sorted `vnp_*` fields, values URL-encoded with `+` for spaces, using HMAC-SHA512. */
export function vnpaySigningData(params: Readonly<Record<string, string>>): string {
  return Object.keys(params)
    .filter((key) => key !== 'vnp_SecureHash' && key !== 'vnp_SecureHashType')
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key] as string).replace(/%20/g, '+')}`)
    .join('&');
}

export function vnpaySign(params: Readonly<Record<string, string>>, hashSecret: string): string {
  return createHmac('sha512', hashSecret).update(vnpaySigningData(params), 'utf8').digest('hex');
}

/** `yyyyMMddHHmmss` in Vietnam time (UTC+7), the format of `vnp_CreateDate` and `vnp_ExpireDate`. */
export function vnpayDate(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 3_600_000);
  return shifted.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

const safeEqualHex = (a: string, b: string) => {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};

/** VNPay sandbox (ADR-0021): redirect to the VNPay page, mark paid from the IPN, never from the return URL. */
@Injectable()
export class VnpayGateway implements PaymentGateway<Record<string, string>> {
  readonly provider = 'VNPAY' as const;

  isConfigured(): boolean {
    return paymentsConfig().vnpay !== null;
  }

  async createCheckout(payment: PaymentSnapshot): Promise<PaymentCheckoutData> {
    const config = paymentsConfig();
    if (!config.vnpay) throw new Error('VNPay is not configured');
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: config.vnpay.tmnCode,
      vnp_Amount: String(payment.amountVnd * 100),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_CurrCode: 'VND',
      vnp_IpAddr: payment.clientIp,
      vnp_Locale: 'vn',
      vnp_OrderInfo: payment.description,
      vnp_OrderType: 'other',
      vnp_ReturnUrl: `${config.appUrl}/api/v1/payments/return/vnpay`,
      vnp_TxnRef: payment.referenceCode,
      vnp_ExpireDate: vnpayDate(payment.expiresAt),
    };
    const query = `${vnpaySigningData(params)}&vnp_SecureHash=${vnpaySign(params, config.vnpay.hashSecret)}`;
    return {
      type: 'REDIRECT',
      url: `${config.vnpay.payUrl}?${query}`,
      deeplink: null,
      qrImageUrl: null,
    };
  }

  /** Works for the IPN and for the return query: both carry the same signed fields. */
  verifyCallback(query: Record<string, string>): WebhookVerdict {
    const config = paymentsConfig().vnpay;
    if (!config) return { signatureValid: false, reason: 'VNPAY_NOT_CONFIGURED' };
    const parsed = VnpayCallbackQuerySchema.safeParse(query);
    if (!parsed.success) return { signatureValid: false, reason: 'MALFORMED_QUERY' };
    if (!safeEqualHex(parsed.data.vnp_SecureHash, vnpaySign(query, config.hashSecret))) {
      return { signatureValid: false, reason: 'BAD_SIGNATURE' };
    }
    const cents = Number(parsed.data.vnp_Amount);
    const paid =
      parsed.data.vnp_ResponseCode === '00' && (parsed.data.vnp_TransactionStatus ?? '00') === '00';
    return {
      signatureValid: true,
      event: {
        provider: 'VNPAY',
        referenceCode: parsed.data.vnp_TxnRef,
        providerTxnId:
          parsed.data.vnp_TransactionNo ??
          `${parsed.data.vnp_TxnRef}-${parsed.data.vnp_ResponseCode}`,
        // VNPay amounts are VND x 100; anything that is not a whole VND can never match.
        amountVnd: Number.isInteger(cents) && cents % 100 === 0 ? cents / 100 : Number.NaN,
        outcome: paid ? 'PAID' : 'FAILED',
        raw: { ...query },
      },
    };
  }
}
