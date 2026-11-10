import {
  DEFAULT_DEPOSIT_PERCENT,
  isValidDepositPercent,
  ONLINE_PAYMENT_METHODS,
  type OnlinePaymentMethod,
  PAYMENT_EXPIRY_MS,
} from '@vcraft/domain';

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

export type GatewayMode = 'sandbox' | 'production';

export interface VnpayConfig {
  /** `sandbox`: fake money, offered only when `APP_ENV` is not production. `production`: real money. */
  mode: GatewayMode;
  tmnCode: string;
  hashSecret: string;
  /** The payment page the buyer is sent to. */
  payUrl: string;
  /** The merchant API (`querydr`) used to ask VNPay for the state of a transaction. */
  apiUrl: string;
}

export interface MomoConfig {
  mode: GatewayMode;
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  /** The create-payment endpoint (`captureWallet`). */
  endpoint: string;
  /** The transaction status query endpoint. */
  queryEndpoint: string;
}

export interface PaymentsConfig {
  /** Deposit share in percent (`PAYMENT_DEPOSIT_PERCENT`, default 30). */
  depositPercent: number;
  /** How long a pending bank-transfer payment waits for the money. */
  expiryMs: number;
  /** How long a pending VNPay or MoMo payment waits (`PAYMENT_WALLET_EXPIRES_IN_MINUTES`, default 30). */
  walletExpiryMs: number;
  /** Production waits for a paid deposit. Defaults to on whenever SePay is configured, and off in demo mode. */
  depositRequired: boolean;
  /**
   * Demo payment mode (`PAYMENTS_DEMO_MODE=true`, ADR-0025): every method is offered without credentials and
   * rehearsed through our own confirm page; no provider is called and no money moves. Allowed under
   * `APP_ENV=production`, because it is its own explicit flag.
   */
  demo: boolean;
  /** `APP_ENV` is not `production`: the administrator "simulate transfer" button works. */
  sandbox: boolean;
  /** Public origin of the web (and of `/api/v1` behind its rewrite), for return and IPN URLs. */
  appUrl: string;
  /** Upper amount limit of VNPay (`VNPAY_MAX_AMOUNT_VND`). */
  vnpayMaxVnd: number;
  /** Upper amount limit of MoMo (`MOMO_MAX_AMOUNT_VND`). */
  momoMaxVnd: number;
  sepay: SepayConfig | null;
  /** `null`: not offered (mode off, credentials or URLs missing, or sandbox refused in production). */
  vnpay: VnpayConfig | null;
  momo: MomoConfig | null;
}

const text = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const VNPAY_SANDBOX_PAY_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
export const VNPAY_SANDBOX_API_URL = 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
export const MOMO_SANDBOX_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';
export const MOMO_SANDBOX_QUERY_ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/query';
export const SEPAY_QR_BASE_URL = 'https://qr.sepay.vn/img';

/** Amount limits per method, in whole VND (provider documentation; VNPay and MoMo maxima are overridable). */
export const SEPAY_MIN_VND = 1;
export const VNPAY_MIN_VND = 5_000;
export const VNPAY_DEFAULT_MAX_VND = 999_999_999;
export const MOMO_MIN_VND = 1_000;
export const MOMO_DEFAULT_MAX_VND = 50_000_000;
export const DEFAULT_WALLET_EXPIRY_MINUTES = 30;

const SEPAY_VARIABLES = [
  'SEPAY_WEBHOOK_API_KEY',
  'SEPAY_BANK_NAME',
  'SEPAY_BANK_ACCOUNT_NUMBER',
  'SEPAY_BANK_ACCOUNT_NAME',
] as const;

const isHttps = (url: string) => /^https:\/\//i.test(url);

/** `.../create` becomes `.../query`; anything else cannot be derived. */
function deriveMomoQueryEndpoint(endpoint: string): string | null {
  return /\/create\/?$/.test(endpoint) ? endpoint.replace(/\/create\/?$/, '/query') : null;
}

function resolvePayments(env: NodeJS.ProcessEnv): { config: PaymentsConfig; issues: string[] } {
  const issues: string[] = [];
  const percent = Number(env.PAYMENT_DEPOSIT_PERCENT);
  const hours = Number(env.PAYMENT_EXPIRES_IN_HOURS);
  const appEnvProduction = env.APP_ENV?.trim().toLowerCase() === 'production';
  const appUrl = (text(env.APP_URL) ?? 'http://localhost:8080').replace(/\/+$/, '');

  const positiveInteger = (name: string, fallback: number): number => {
    const raw = text(env[name]);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (Number.isInteger(value) && value > 0) return value;
    issues.push(`${name} must be a positive whole number; using ${fallback}`);
    return fallback;
  };

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
  const sepaySet = SEPAY_VARIABLES.filter((name) => text(env[name]) !== null);
  if (sepaySet.length > 0 && sepaySet.length < SEPAY_VARIABLES.length) {
    const missing = SEPAY_VARIABLES.filter((name) => text(env[name]) === null);
    issues.push(
      `SePay is only partly configured, bank transfer is off; missing ${missing.join(', ')}`,
    );
  }

  const legacySandbox = env.PAYMENTS_SANDBOX_GATEWAYS?.trim().toLowerCase() === 'true';
  const modeOf = (name: 'VNPAY_MODE' | 'MOMO_MODE'): 'off' | GatewayMode => {
    const raw = text(env[name])?.toLowerCase();
    if (raw === undefined || raw === null) return legacySandbox ? 'sandbox' : 'off';
    if (raw === 'off' || raw === 'sandbox' || raw === 'production') return raw;
    issues.push(`${name} must be off, sandbox or production; the gateway is off`);
    return 'off';
  };
  /** The shared checks of a gateway that is switched on; the problems found make it unavailable. */
  const commonProblems = (label: string, mode: GatewayMode): boolean => {
    if (mode === 'sandbox' && appEnvProduction) {
      issues.push(
        `${label} is in sandbox mode, which is refused while APP_ENV=production; the gateway is off`,
      );
      return true;
    }
    if (mode === 'production' && !isHttps(appUrl)) {
      issues.push(
        `${label} is in production mode but APP_URL is not an https URL; the gateway is off`,
      );
      return true;
    }
    return false;
  };
  const urlProblems = (
    label: string,
    mode: GatewayMode,
    urls: ReadonlyArray<readonly [string, string | null]>,
  ): boolean => {
    let problem = false;
    for (const [name, value] of urls) {
      if (mode === 'production' && value === null) {
        issues.push(
          `${label} production mode needs ${name} (from the provider's onboarding); the gateway is off`,
        );
        problem = true;
      } else if (mode === 'production' && value !== null && !isHttps(value)) {
        issues.push(`${name} must be an https URL in production mode; the gateway is off`);
        problem = true;
      }
    }
    return problem;
  };

  let vnpay: VnpayConfig | null = null;
  const vnpayMode = modeOf('VNPAY_MODE');
  if (vnpayMode !== 'off') {
    const tmnCode = text(env.VNPAY_TMN_CODE);
    const hashSecret = text(env.VNPAY_HASH_SECRET);
    const payUrl = text(env.VNPAY_PAY_URL);
    const apiUrl = text(env.VNPAY_API_URL);
    let blocked = commonProblems('VNPay', vnpayMode);
    if (!tmnCode || !hashSecret) {
      issues.push(
        'VNPay is on but VNPAY_TMN_CODE or VNPAY_HASH_SECRET is missing; the gateway is off',
      );
      blocked = true;
    }
    blocked =
      urlProblems('VNPay', vnpayMode, [
        ['VNPAY_PAY_URL', payUrl],
        ['VNPAY_API_URL', apiUrl],
      ]) || blocked;
    if (!blocked && tmnCode && hashSecret) {
      vnpay = {
        mode: vnpayMode,
        tmnCode,
        hashSecret,
        payUrl: payUrl ?? VNPAY_SANDBOX_PAY_URL,
        apiUrl: apiUrl ?? VNPAY_SANDBOX_API_URL,
      };
    }
  }

  let momo: MomoConfig | null = null;
  const momoMode = modeOf('MOMO_MODE');
  if (momoMode !== 'off') {
    const partnerCode = text(env.MOMO_PARTNER_CODE);
    const accessKey = text(env.MOMO_ACCESS_KEY);
    const secretKey = text(env.MOMO_SECRET_KEY);
    const explicitEndpoint = text(env.MOMO_ENDPOINT);
    const endpoint = explicitEndpoint ?? (momoMode === 'sandbox' ? MOMO_SANDBOX_ENDPOINT : null);
    const explicitQuery = text(env.MOMO_QUERY_ENDPOINT);
    const derived = endpoint ? deriveMomoQueryEndpoint(endpoint) : null;
    const queryEndpoint =
      explicitQuery ?? derived ?? (momoMode === 'sandbox' ? MOMO_SANDBOX_QUERY_ENDPOINT : null);
    let blocked = commonProblems('MoMo', momoMode);
    if (!partnerCode || !accessKey || !secretKey) {
      issues.push(
        'MoMo is on but MOMO_PARTNER_CODE, MOMO_ACCESS_KEY or MOMO_SECRET_KEY is missing; the gateway is off',
      );
      blocked = true;
    }
    if (momoMode === 'production' && endpoint && queryEndpoint === null) {
      issues.push(
        'MoMo production mode: MOMO_QUERY_ENDPOINT is not set and cannot be derived from MOMO_ENDPOINT; the gateway is off',
      );
      blocked = true;
    }
    blocked =
      urlProblems('MoMo', momoMode, [
        ['MOMO_ENDPOINT', explicitEndpoint],
        ...(queryEndpoint ? ([['MOMO_QUERY_ENDPOINT', queryEndpoint]] as const) : []),
      ]) || blocked;
    if (!blocked && partnerCode && accessKey && secretKey && endpoint && queryEndpoint) {
      momo = { mode: momoMode, partnerCode, accessKey, secretKey, endpoint, queryEndpoint };
    }
  }

  const demo = env.PAYMENTS_DEMO_MODE?.trim().toLowerCase() === 'true';
  if (demo) issues.push('demo payment mode is on: no real money moves');

  const required = env.PAYMENTS_DEPOSIT_REQUIRED?.trim().toLowerCase();
  const config: PaymentsConfig = {
    depositPercent: isValidDepositPercent(percent) ? percent : DEFAULT_DEPOSIT_PERCENT,
    expiryMs: Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : PAYMENT_EXPIRY_MS,
    walletExpiryMs:
      positiveInteger('PAYMENT_WALLET_EXPIRES_IN_MINUTES', DEFAULT_WALLET_EXPIRY_MINUTES) * 60_000,
    depositRequired:
      required === undefined || required === '' ? sepay !== null && !demo : required === 'true',
    demo,
    sandbox: !appEnvProduction,
    appUrl,
    vnpayMaxVnd: positiveInteger('VNPAY_MAX_AMOUNT_VND', VNPAY_DEFAULT_MAX_VND),
    momoMaxVnd: positiveInteger('MOMO_MAX_AMOUNT_VND', MOMO_DEFAULT_MAX_VND),
    sepay,
    vnpay,
    momo,
  };
  return { config, issues };
}

export function paymentsConfig(env: NodeJS.ProcessEnv = process.env): PaymentsConfig {
  return resolvePayments(env).config;
}

/**
 * Human-readable problems with the payment variables: a gateway that is switched on but cannot work, a
 * sandbox gateway refused in production, a half-filled SePay account. Never contains a secret value.
 */
export function paymentsConfigIssues(env: NodeJS.ProcessEnv = process.env): string[] {
  return resolvePayments(env).issues;
}

/** The online methods this deployment offers right now. */
export function availableMethods(config: PaymentsConfig) {
  if (config.demo) return [...ONLINE_PAYMENT_METHODS];
  const methods: OnlinePaymentMethod[] = [];
  if (config.sepay) methods.push('SEPAY_TRANSFER');
  if (config.vnpay) methods.push('VNPAY');
  if (config.momo) methods.push('MOMO');
  return methods;
}

export interface MethodLimit {
  minVnd: number;
  /** `null`: no upper limit. */
  maxVnd: number | null;
}

/** The amount a single payment of each method may have, in whole VND. */
export function methodLimits(config: PaymentsConfig): Record<OnlinePaymentMethod, MethodLimit> {
  return {
    SEPAY_TRANSFER: { minVnd: SEPAY_MIN_VND, maxVnd: null },
    VNPAY: { minVnd: VNPAY_MIN_VND, maxVnd: config.vnpayMaxVnd },
    MOMO: { minVnd: MOMO_MIN_VND, maxVnd: config.momoMaxVnd },
  };
}

/** One line for the boot log: which methods are on and in which mode. */
export function describePaymentsConfig(config: PaymentsConfig): string {
  if (config.demo) {
    return 'online payment is in DEMO mode: all methods are rehearsed on a confirm page, no real money moves';
  }
  const parts = [
    config.sepay ? 'SEPAY_TRANSFER' : null,
    config.vnpay ? `VNPAY(${config.vnpay.mode})` : null,
    config.momo ? `MOMO(${config.momo.mode})` : null,
  ].filter((part) => part !== null);
  return parts.length > 0
    ? `online payment methods on: ${parts.join(', ')}`
    : 'online payment is off';
}
