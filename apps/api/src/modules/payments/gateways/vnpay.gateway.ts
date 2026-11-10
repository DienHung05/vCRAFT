import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { VnpayCallbackQuerySchema } from '@vcraft/contracts';
import type { PaymentCheckoutData } from '@vcraft/database';
import { paymentsConfig } from '../payments.config';
import {
  PAYMENT_HTTP,
  type PaymentGateway,
  type PaymentHttp,
  type PaymentSnapshot,
  type PaymentStatusQuery,
  type ProviderStatus,
  type WebhookVerdict,
} from './payment-gateway';

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

/**
 * The fields of a `querydr` request, in the order VNPay checksums them (v2.1.0): joined by `|`, HMAC-SHA512,
 * hex. A missing field counts as an empty string.
 */
export const VNPAY_QUERY_REQUEST_FIELDS = [
  'vnp_RequestId',
  'vnp_Version',
  'vnp_Command',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_TransactionDate',
  'vnp_CreateDate',
  'vnp_IpAddr',
  'vnp_OrderInfo',
] as const;

/** The fields of a `querydr` response, in the order VNPay checksums them. */
export const VNPAY_QUERY_RESPONSE_FIELDS = [
  'vnp_ResponseId',
  'vnp_Command',
  'vnp_ResponseCode',
  'vnp_Message',
  'vnp_TmnCode',
  'vnp_TxnRef',
  'vnp_Amount',
  'vnp_BankCode',
  'vnp_PayDate',
  'vnp_TransactionNo',
  'vnp_TransactionType',
  'vnp_TransactionStatus',
  'vnp_OrderInfo',
  'vnp_PromotionCode',
  'vnp_PromotionAmount',
] as const;

/** HMAC-SHA512 over the listed fields joined by `|` (the checksum of the merchant API, not of the pay URL). */
export function vnpayApiSign(
  fields: readonly string[],
  values: Readonly<Record<string, string | undefined>>,
  hashSecret: string,
): string {
  const data = fields.map((name) => values[name] ?? '').join('|');
  return createHmac('sha512', hashSecret).update(data, 'utf8').digest('hex');
}

/** `vnp_CreateDate` that was sent with the pay request, read back from the stored redirect URL. */
function createDateOf(checkout: PaymentStatusQuery['checkout']): string | null {
  if (checkout?.type !== 'REDIRECT') return null;
  try {
    const value = new URL(checkout.url).searchParams.get('vnp_CreateDate');
    return value && /^\d{14}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * VNPay (ADR-0021, ADR-0024), sandbox or production by mode: redirect to the VNPay page, mark paid from the IPN
 * or a verified querydr answer, never from the return URL.
 */
@Injectable()
export class VnpayGateway implements PaymentGateway<Record<string, string>> {
  readonly provider = 'VNPAY' as const;
  private readonly logger = new Logger(VnpayGateway.name);

  constructor(@Inject(PAYMENT_HTTP) private readonly http: PaymentHttp) {}

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
    if (parsed.data.vnp_TmnCode !== config.tmnCode) {
      return { signatureValid: false, reason: 'WRONG_MERCHANT' };
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

  /**
   * Asks VNPay (`querydr`) what became of the transaction, for an IPN that never arrived. Only a response whose
   * checksum verifies counts; anything else is "no information".
   */
  async queryStatus(payment: PaymentStatusQuery): Promise<ProviderStatus> {
    const config = paymentsConfig().vnpay;
    if (!config) return { state: 'UNKNOWN', detail: 'VNPay is not configured' };
    const request: Record<string, string> = {
      vnp_RequestId: randomUUID().replace(/-/g, ''),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: config.tmnCode,
      vnp_TxnRef: payment.referenceCode,
      vnp_TransactionDate: createDateOf(payment.checkout) ?? vnpayDate(payment.createdAt),
      vnp_CreateDate: vnpayDate(new Date()),
      vnp_IpAddr: process.env.VNPAY_SERVER_IP?.trim() || '127.0.0.1',
      vnp_OrderInfo: `Query ${payment.referenceCode}`,
    };
    const body = {
      ...request,
      vnp_SecureHash: vnpayApiSign(VNPAY_QUERY_REQUEST_FIELDS, request, config.hashSecret),
    };
    let answer: Record<string, unknown>;
    try {
      const response = await this.http(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok)
        return { state: 'UNKNOWN', detail: `VNPay answered HTTP ${response.status}` };
      answer = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      return {
        state: 'UNKNOWN',
        detail: `VNPay could not be reached: ${error instanceof Error ? error.message : error}`,
      };
    }
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(answer ?? {})) {
      if (typeof value === 'string' || typeof value === 'number') fields[key] = String(value);
    }
    const hash = fields.vnp_SecureHash;
    if (
      !hash ||
      !safeEqualHex(hash, vnpayApiSign(VNPAY_QUERY_RESPONSE_FIELDS, fields, config.hashSecret))
    ) {
      this.logger.warn(`querydr answer for ${payment.referenceCode} has a bad or missing checksum`);
      return { state: 'UNKNOWN', detail: 'VNPay answer has a bad or missing checksum' };
    }
    const code = fields.vnp_ResponseCode;
    if (code === '91') return { state: 'PENDING', detail: 'VNPay has no such transaction yet' };
    if (code !== '00') return { state: 'UNKNOWN', detail: `VNPay ResponseCode ${code}` };
    if (fields.vnp_TxnRef !== payment.referenceCode || fields.vnp_TmnCode !== config.tmnCode) {
      return { state: 'UNKNOWN', detail: 'VNPay answer is for another transaction' };
    }
    const status = fields.vnp_TransactionStatus;
    if (status === '01') return { state: 'PENDING', detail: 'VNPay transaction not complete' };
    if (status !== '00' && status !== '02') {
      return { state: 'UNKNOWN', detail: `VNPay TransactionStatus ${status}` };
    }
    const cents = Number(fields.vnp_Amount);
    const transactionNo = fields.vnp_TransactionNo;
    if (status === '00' && !transactionNo) {
      return { state: 'UNKNOWN', detail: 'VNPay paid answer has no transaction number' };
    }
    return {
      state: status === '00' ? 'PAID' : 'FAILED',
      event: {
        provider: 'VNPAY',
        referenceCode: payment.referenceCode,
        providerTxnId: transactionNo || `${payment.referenceCode}-${status}`,
        amountVnd: Number.isInteger(cents) && cents % 100 === 0 ? cents / 100 : Number.NaN,
        outcome: status === '00' ? 'PAID' : 'FAILED',
        raw: { source: 'query', ...fields },
      },
    };
  }
}
