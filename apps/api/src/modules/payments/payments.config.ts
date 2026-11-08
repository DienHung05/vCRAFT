import { DEFAULT_DEPOSIT_PERCENT, isValidDepositPercent, PAYMENT_EXPIRY_MS } from '@vcraft/domain';

/**
 * Online payment settings (ADR-0021, GH#205), all from the environment and read at call time. Everything is
 * off when its variables are unset: no SePay account means no payment methods and no deposit gate. Secrets
 * (`SEPAY_WEBHOOK_API_KEY`, `VNPAY_HASH_SECRET`, `MOMO_SECRET_KEY`...) live on Render only, never on Vercel.
 */
export interface SepayConfig {
  /** Checked against the `Authorization: Apikey <key>` header of the bank-account webhook. */
  webhookApiKey: string;
  bankName: string;
  /** SePay QR service bank code or short name (e.g. `MBBank`); with it the QR image URL is built. */
  bankCode: string | null;
  /** The bank's six-digit NAPAS BIN; with it the VietQR (EMVCo) payload is built. */
  bankBin: string | null;
  accountNumber: string;
  accountName: string;
  /** Base URL of the QR image service. */
  qrBaseUrl: string;
}

export interface VnpayConfig {
  tmnCode: string;
  hashSecret: string;
  payUrl: string;
}

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  /** The create-payment endpoint of the MoMo test environment unless overridden. */
  endpoint: string;
}

export interface PaymentsConfig {
  /** Deposit share in percent (`PAYMENT_DEPOSIT_PERCENT`, default 30). */
  depositPercent: number;
  /** How long a pending payment waits for the money. */
  expiryMs: number;
  /** Production waits for a paid deposit. Defaults to on whenever SePay is configured. */
  depositRequired: boolean;
  /** `APP_ENV` is not `production`: the administrator "simulate transfer" button works. */
  sandbox: boolean;
  /** `PAYMENTS_SANDBOX_GATEWAYS=true`: VNPay and MoMo sandboxes are offered. Leave unset in production. */
  sandboxGateways: boolean;
  /** Public origin of the web (and of `/api/v1` behind its rewrite), for return and IPN URLs. */
  appUrl: string;
  sepay: SepayConfig | null;
  vnpay: VnpayConfig | null;
  momo: MomoConfig | null;
}

const text = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const VNPAY_SANDBOX_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const MOMO_SANDBOX_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
export const SEPAY_QR_BASE_URL = 'https://qr.sepay.vn/img';

export function paymentsConfig(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  const percent = Number(env.PAYMENT_DEPOSIT_PERCENT);
  const hours = Number(env.PAYMENT_EXPIRES_IN_HOURS);

  const apiKey = text(env.SEPAY_WEBHOOK_API_KEY);
  const accountNumber = text(env.SEPAY_BANK_ACCOUNT_NUMBER);
  const accountName = text(env.SEPAY_BANK_ACCOUNT_NAME);
  const bankName = text(env.SEPAY_BANK_NAME);
  const sepay =
    apiKey && accountNumber && accountName && bankName
      ? {
          webhookApiKey: apiKey,
          bankName,
          bankCode: text(env.SEPAY_BANK_CODE),
          bankBin: text(env.SEPAY_BANK_BIN),
          accountNumber,
          accountName,
          qrBaseUrl: text(env.SEPAY_QR_BASE_URL) ?? SEPAY_QR_BASE_URL,
        }
      : null;

  const tmnCode = text(env.VNPAY_TMN_CODE);
  const hashSecret = text(env.VNPAY_HASH_SECRET);
  const vnpay =
    tmnCode && hashSecret
      ? { tmnCode, hashSecret, payUrl: text(env.VNPAY_PAY_URL) ?? VNPAY_SANDBOX_PAY_URL }
      : null;

  const partnerCode = text(env.MOMO_PARTNER_CODE);
  const accessKey = text(env.MOMO_ACCESS_KEY);
  const secretKey = text(env.MOMO_SECRET_KEY);
  const momo =
    partnerCode && accessKey && secretKey
      ? {
          partnerCode,
          accessKey,
          secretKey,
          endpoint: text(env.MOMO_ENDPOINT) ?? MOMO_SANDBOX_ENDPOINT,
        }
      : null;

  const required = env.PAYMENTS_DEPOSIT_REQUIRED?.trim().toLowerCase();
  return {
    depositPercent: isValidDepositPercent(percent) ? percent : DEFAULT_DEPOSIT_PERCENT,
    expiryMs: Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : PAYMENT_EXPIRY_MS,
    depositRequired:
      required === undefined || required === '' ? sepay !== null : required === 'true',
    sandbox: env.APP_ENV?.trim().toLowerCase() !== 'production',
    sandboxGateways: env.PAYMENTS_SANDBOX_GATEWAYS?.trim().toLowerCase() === 'true',
    appUrl: (text(env.APP_URL) ?? 'http://localhost:8080').replace(/\/+$/, ''),
    sepay,
    vnpay,
    momo,
  };
}

/** The online methods this deployment offers right now. VNPay and MoMo need the flag and their credentials. */
export function availableMethods(config: PaymentsConfig) {
  const methods: Array<'SEPAY_TRANSFER' | 'VNPAY' | 'MOMO'> = [];
  if (config.sepay) methods.push('SEPAY_TRANSFER');
  if (config.sandboxGateways && config.vnpay) methods.push('VNPAY');
  if (config.sandboxGateways && config.momo) methods.push('MOMO');
  return methods;
}
