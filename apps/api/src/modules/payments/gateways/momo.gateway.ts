import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { MomoCallbackSchema } from '@vcraft/contracts';
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

/** MoMo `resultCode` for a successful payment. */
export const MOMO_RESULT_SUCCESS = 0;
/**
 * `resultCode` 9000 "transaction is authorized successfully". For a 1-step payment MoMo says to treat it as
 * success (only a 2-step payment needs a later capture/cancel). We always create with `autoCapture: true`
 * (1-step), so 9000 counts as paid.
 */
export const MOMO_RESULT_AUTHORIZED = 9000;
/**
 * `resultCode`s that mean "not finished yet", not "failed": the buyer is still paying or MoMo is still
 * processing (1000 initiated, 7000 processing, 7002 processing at the payment instrument's provider).
 */
export const MOMO_IN_PROGRESS_CODES: readonly number[] = [1000, 7000, 7002];
const isMomoPaid = (resultCode: number) =>
  resultCode === MOMO_RESULT_SUCCESS || resultCode === MOMO_RESULT_AUTHORIZED;
/** `resultCode`s that end the attempt without money (declined, cancelled, expired, insufficient funds...). */
export const MOMO_FAILURE_CODES: readonly number[] = [
  1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026,
];

const hmacSha256 = (secret: string, data: string) =>
  createHmac('sha256', secret).update(data, 'utf8').digest('hex');

/** The string MoMo signs when a merchant creates a `captureWallet` payment (developers.momo.vn, v2). */
export function momoCreateSigningData(
  accessKey: string,
  fields: Readonly<
    Record<
      | 'amount'
      | 'extraData'
      | 'ipnUrl'
      | 'orderId'
      | 'orderInfo'
      | 'partnerCode'
      | 'redirectUrl'
      | 'requestId'
      | 'requestType',
      string
    >
  >,
): string {
  return (
    `accessKey=${accessKey}&amount=${fields.amount}&extraData=${fields.extraData}&ipnUrl=${fields.ipnUrl}` +
    `&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}&partnerCode=${fields.partnerCode}` +
    `&redirectUrl=${fields.redirectUrl}&requestId=${fields.requestId}&requestType=${fields.requestType}`
  );
}

/** The string MoMo signs on an IPN or redirect call. */
export function momoCallbackSigningData(
  accessKey: string,
  fields: Readonly<
    Record<
      | 'amount'
      | 'extraData'
      | 'message'
      | 'orderId'
      | 'orderInfo'
      | 'orderType'
      | 'partnerCode'
      | 'payType'
      | 'requestId'
      | 'responseTime'
      | 'resultCode'
      | 'transId',
      string | number
    >
  >,
): string {
  return (
    `accessKey=${accessKey}&amount=${fields.amount}&extraData=${fields.extraData}&message=${fields.message}` +
    `&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}&orderType=${fields.orderType}` +
    `&partnerCode=${fields.partnerCode}&payType=${fields.payType}&requestId=${fields.requestId}` +
    `&responseTime=${fields.responseTime}&resultCode=${fields.resultCode}&transId=${fields.transId}`
  );
}

export function momoSign(secretKey: string, data: string): string {
  return hmacSha256(secretKey, data);
}

const safeEqualHex = (a: string, b: string) => {
  const left = Buffer.from(a.toLowerCase(), 'utf8');
  const right = Buffer.from(b.toLowerCase(), 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
};

/** The string MoMo signs on a transaction status query (`/v2/gateway/api/query`). */
export function momoQuerySigningData(
  accessKey: string,
  fields: Readonly<Record<'orderId' | 'partnerCode' | 'requestId', string>>,
): string {
  return `accessKey=${accessKey}&orderId=${fields.orderId}&partnerCode=${fields.partnerCode}&requestId=${fields.requestId}`;
}

/**
 * MoMo (ADR-0021, ADR-0024), test or production endpoints by mode: `captureWallet` create returns a `payUrl`, an app deeplink and a QR; the
 * money is confirmed by the IPN (HMAC-SHA256), never by the redirect back.
 */
@Injectable()
export class MomoGateway implements PaymentGateway<Record<string, unknown>> {
  readonly provider = 'MOMO' as const;

  constructor(@Inject(PAYMENT_HTTP) private readonly http: PaymentHttp) {}

  isConfigured(): boolean {
    return paymentsConfig().momo !== null;
  }

  async createCheckout(payment: PaymentSnapshot): Promise<PaymentCheckoutData> {
    const config = paymentsConfig();
    if (!config.momo) throw new Error('MoMo is not configured');
    const fields = {
      amount: String(payment.amountVnd),
      extraData: '',
      ipnUrl: `${config.appUrl}/api/v1/payments/webhooks/momo`,
      orderId: payment.referenceCode,
      orderInfo: payment.description,
      partnerCode: config.momo.partnerCode,
      redirectUrl: `${config.appUrl}/api/v1/payments/return/momo`,
      requestId: randomUUID(),
      requestType: 'captureWallet',
    };
    const signature = momoSign(
      config.momo.secretKey,
      momoCreateSigningData(config.momo.accessKey, fields),
    );
    const response = await this.http(config.momo.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        ...fields,
        amount: payment.amountVnd,
        partnerName: 'vCraft',
        storeId: 'vcraft',
        lang: 'vi',
        autoCapture: true,
        signature,
      }),
    });
    const body = (await response.json()) as {
      resultCode?: number;
      payUrl?: string;
      deeplink?: string;
      qrCodeUrl?: string;
    };
    if (!response.ok || body.resultCode !== 0 || !body.payUrl) {
      throw new Error(`MoMo refused the payment (resultCode ${body.resultCode ?? 'none'})`);
    }
    return {
      type: 'REDIRECT',
      url: body.payUrl,
      deeplink: body.deeplink ?? null,
      qrImageUrl: body.qrCodeUrl ?? null,
    };
  }

  /** Works for the IPN body and for the redirect query: both carry the same signed fields. */
  verifyCallback(input: Record<string, unknown>): WebhookVerdict {
    const config = paymentsConfig().momo;
    if (!config) return { signatureValid: false, reason: 'MOMO_NOT_CONFIGURED' };
    const parsed = MomoCallbackSchema.safeParse(input);
    if (!parsed.success) return { signatureValid: false, reason: 'MALFORMED_BODY' };
    const data = parsed.data;
    if (data.partnerCode !== config.partnerCode) {
      return { signatureValid: false, reason: 'WRONG_PARTNER' };
    }
    const expected = momoSign(config.secretKey, momoCallbackSigningData(config.accessKey, data));
    if (!safeEqualHex(data.signature, expected)) {
      return { signatureValid: false, reason: 'BAD_SIGNATURE' };
    }
    if (!isMomoPaid(data.resultCode) && !MOMO_FAILURE_CODES.includes(data.resultCode)) {
      // Still in progress, or a code that says nothing final: leave the payment pending.
      return {
        signatureValid: true,
        event: null,
        ignored: 'STILL_PROCESSING',
        referenceCode: data.orderId,
      };
    }
    return {
      signatureValid: true,
      event: {
        provider: 'MOMO',
        referenceCode: data.orderId,
        providerTxnId: data.transId,
        amountVnd: data.amount,
        outcome: isMomoPaid(data.resultCode) ? 'PAID' : 'FAILED',
        raw: { ...input },
      },
    };
  }

  /**
   * Asks MoMo (`/v2/gateway/api/query`) what became of the order, for an IPN that never arrived. The answer is
   * trusted because it comes over TLS from the configured endpoint; it must name our order and partner.
   */
  async queryStatus(payment: PaymentStatusQuery): Promise<ProviderStatus> {
    const config = paymentsConfig().momo;
    if (!config) return { state: 'UNKNOWN', detail: 'MoMo is not configured' };
    const fields = {
      orderId: payment.referenceCode,
      partnerCode: config.partnerCode,
      requestId: randomUUID(),
    };
    const signature = momoSign(config.secretKey, momoQuerySigningData(config.accessKey, fields));
    let answer: Record<string, unknown>;
    try {
      const response = await this.http(config.queryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ ...fields, lang: 'vi', signature }),
      });
      if (!response.ok)
        return { state: 'UNKNOWN', detail: `MoMo answered HTTP ${response.status}` };
      answer = (await response.json()) as Record<string, unknown>;
    } catch (error) {
      return {
        state: 'UNKNOWN',
        detail: `MoMo could not be reached: ${error instanceof Error ? error.message : error}`,
      };
    }
    if (answer?.orderId !== payment.referenceCode || answer.partnerCode !== config.partnerCode) {
      return { state: 'UNKNOWN', detail: 'MoMo answer is for another order' };
    }
    const code = Number(answer.resultCode);
    if (isMomoPaid(code)) {
      const amount = Number(answer.amount);
      const transId =
        answer.transId === undefined || answer.transId === null ? '' : String(answer.transId);
      if (!transId) return { state: 'UNKNOWN', detail: 'MoMo paid answer has no transaction id' };
      return {
        state: 'PAID',
        event: {
          provider: 'MOMO',
          referenceCode: payment.referenceCode,
          providerTxnId: transId,
          amountVnd: amount,
          outcome: 'PAID',
          raw: { source: 'query', ...answer },
        },
      };
    }
    if (MOMO_IN_PROGRESS_CODES.includes(code)) {
      return { state: 'PENDING', detail: `MoMo resultCode ${code}` };
    }
    if (MOMO_FAILURE_CODES.includes(code)) {
      return {
        state: 'FAILED',
        event: {
          provider: 'MOMO',
          referenceCode: payment.referenceCode,
          providerTxnId: String(answer.transId ?? `${payment.referenceCode}-${code}`),
          amountVnd: Number(answer.amount),
          outcome: 'FAILED',
          raw: { source: 'query', ...answer },
        },
      };
    }
    return { state: 'UNKNOWN', detail: `MoMo resultCode ${answer.resultCode}` };
  }
}
