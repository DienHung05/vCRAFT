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
  type WebhookVerdict,
} from './payment-gateway';

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

/**
 * MoMo test environment (ADR-0021): `captureWallet` create returns a `payUrl`, an app deeplink and a QR; the
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
    return {
      signatureValid: true,
      event: {
        provider: 'MOMO',
        referenceCode: data.orderId,
        providerTxnId: data.transId,
        amountVnd: data.amount,
        outcome: data.resultCode === 0 ? 'PAID' : 'FAILED',
        raw: { ...input },
      },
    };
  }
}
