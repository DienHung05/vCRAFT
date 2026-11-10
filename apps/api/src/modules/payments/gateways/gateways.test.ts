import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  availableMethods,
  methodLimits,
  paymentsConfig,
  paymentsConfigIssues,
} from '../payments.config';
import { MomoGateway } from './momo.gateway';
import type { PaymentHttp, PaymentSnapshot } from './payment-gateway';
import { SepayGateway } from './sepay.gateway';
import { VnpayGateway, vnpayDate } from './vnpay.gateway';

const SEPAY_ENV = {
  SEPAY_WEBHOOK_API_KEY: 'sepay-test-key',
  SEPAY_BANK_NAME: 'MB Bank',
  SEPAY_BANK_CODE: 'MBBank',
  SEPAY_BANK_BIN: '970422',
  SEPAY_BANK_ACCOUNT_NUMBER: '0123456789',
  SEPAY_BANK_ACCOUNT_NAME: 'BAN QUAN LY LANG NGHE BAT TRANG',
};
const VNPAY_ENV = { VNPAY_TMN_CODE: 'TESTTMN1', VNPAY_HASH_SECRET: 'vnpay-test-secret' };
const MOMO_ENV = {
  MOMO_PARTNER_CODE: 'MOMOTEST',
  MOMO_ACCESS_KEY: 'access-key',
  MOMO_SECRET_KEY: 'secret-key',
};

const snapshot: PaymentSnapshot = {
  id: '018f0000-0000-7000-8000-000000000001',
  referenceCode: 'VCPAB3DEF7K9M',
  kind: 'DEPOSIT',
  amountVnd: 3_000_000,
  expiresAt: new Date('2026-11-09T10:00:00Z'),
  description: 'vCraft VCPAB3DEF7K9M',
  clientIp: '203.0.113.7',
};

function setEnv(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

beforeEach(() => {
  // Everything is off unless a test switches it on.
  for (const key of [
    'SEPAY_WEBHOOK_API_KEY',
    'SEPAY_BANK_NAME',
    'SEPAY_BANK_CODE',
    'SEPAY_BANK_BIN',
    'SEPAY_BANK_ACCOUNT_NUMBER',
    'SEPAY_BANK_ACCOUNT_NAME',
    'VNPAY_TMN_CODE',
    'VNPAY_HASH_SECRET',
    'MOMO_PARTNER_CODE',
    'MOMO_ACCESS_KEY',
    'MOMO_SECRET_KEY',
    'PAYMENTS_SANDBOX_GATEWAYS',
    'VNPAY_MODE',
    'MOMO_MODE',
    'VNPAY_PAY_URL',
    'VNPAY_API_URL',
    'VNPAY_SERVER_IP',
    'MOMO_ENDPOINT',
    'MOMO_QUERY_ENDPOINT',
    'VNPAY_MAX_AMOUNT_VND',
    'MOMO_MAX_AMOUNT_VND',
    'PAYMENT_WALLET_EXPIRES_IN_MINUTES',
    'PAYMENTS_DEPOSIT_REQUIRED',
    'PAYMENT_DEPOSIT_PERCENT',
    'PAYMENT_EXPIRES_IN_HOURS',
    'APP_URL',
    'APP_ENV',
  ])
    vi.stubEnv(key, '');
});
afterEach(() => vi.unstubAllEnvs());

describe('payments config', () => {
  it('is entirely off when nothing is set', () => {
    const config = paymentsConfig();
    expect(config.sepay).toBeNull();
    expect(config.vnpay).toBeNull();
    expect(config.momo).toBeNull();
    expect(config.depositRequired).toBe(false);
    expect(config.walletExpiryMs).toBe(30 * 60_000);
    expect(config.depositPercent).toBe(30);
    expect(config.expiryMs).toBe(24 * 3_600_000);
    expect(availableMethods(config)).toEqual([]);
  });

  it('offers SePay once it is configured and gates production on the deposit', () => {
    setEnv(SEPAY_ENV);
    const config = paymentsConfig();
    expect(availableMethods(config)).toEqual(['SEPAY_TRANSFER']);
    expect(config.depositRequired).toBe(true);
    vi.stubEnv('PAYMENTS_DEPOSIT_REQUIRED', 'false');
    expect(paymentsConfig().depositRequired).toBe(false);
  });

  it('hides VNPay and MoMo unless the legacy sandbox flag is on, even with credentials', () => {
    setEnv({ ...SEPAY_ENV, ...VNPAY_ENV, ...MOMO_ENV });
    expect(availableMethods(paymentsConfig())).toEqual(['SEPAY_TRANSFER']);
    vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'true');
    expect(availableMethods(paymentsConfig())).toEqual(['SEPAY_TRANSFER', 'VNPAY', 'MOMO']);
    vi.stubEnv('MOMO_SECRET_KEY', '');
    expect(availableMethods(paymentsConfig())).toEqual(['SEPAY_TRANSFER', 'VNPAY']);
  });

  it('reads the deposit share and the expiry, falling back on bad values', () => {
    vi.stubEnv('PAYMENT_DEPOSIT_PERCENT', '40');
    vi.stubEnv('PAYMENT_EXPIRES_IN_HOURS', '2');
    expect(paymentsConfig().depositPercent).toBe(40);
    expect(paymentsConfig().expiryMs).toBe(2 * 3_600_000);
    vi.stubEnv('PAYMENT_DEPOSIT_PERCENT', '150');
    vi.stubEnv('PAYMENT_EXPIRES_IN_HOURS', '-1');
    expect(paymentsConfig().depositPercent).toBe(30);
    expect(paymentsConfig().expiryMs).toBe(24 * 3_600_000);
  });

  it('treats only APP_ENV=production as production', () => {
    expect(paymentsConfig().sandbox).toBe(true);
    vi.stubEnv('APP_ENV', 'production');
    expect(paymentsConfig().sandbox).toBe(false);
  });
});

describe('payments config: gateway modes', () => {
  const sandboxEnv = { APP_URL: 'https://vcraft.example' };
  const vnpayProduction = {
    VNPAY_MODE: 'production',
    ...VNPAY_ENV,
    VNPAY_PAY_URL: 'https://pay.vnpay.example/vpcpay.html',
    VNPAY_API_URL: 'https://api.vnpay.example/merchant_webapi/api/transaction',
  };
  const momoProduction = {
    MOMO_MODE: 'production',
    ...MOMO_ENV,
    MOMO_ENDPOINT: 'https://payment.momo.example/v2/gateway/api/create',
  };
  const withAppUrl = { APP_URL: 'https://vcraft.example' };

  it.each([
    ['nothing set', {}, null, null],
    ['legacy flag only (no credentials)', { PAYMENTS_SANDBOX_GATEWAYS: 'true' }, null, null],
    [
      'legacy flag with credentials',
      { PAYMENTS_SANDBOX_GATEWAYS: 'true', ...VNPAY_ENV, ...MOMO_ENV },
      'sandbox',
      'sandbox',
    ],
    ['credentials without any mode', { ...VNPAY_ENV, ...MOMO_ENV }, null, null],
    [
      'explicit sandbox without the legacy flag',
      { VNPAY_MODE: 'sandbox', MOMO_MODE: 'SANDBOX', ...VNPAY_ENV, ...MOMO_ENV },
      'sandbox',
      'sandbox',
    ],
    [
      'explicit off beats the legacy flag',
      { PAYMENTS_SANDBOX_GATEWAYS: 'true', VNPAY_MODE: 'off', ...VNPAY_ENV, ...MOMO_ENV },
      null,
      'sandbox',
    ],
    [
      'an unknown mode is off',
      { VNPAY_MODE: 'live', MOMO_MODE: 'prod', ...VNPAY_ENV, ...MOMO_ENV },
      null,
      null,
    ],
  ])('resolves the mode: %s', (_name, env, vnpay, momo) => {
    const config = paymentsConfig({ ...sandboxEnv, ...env });
    expect(config.vnpay?.mode ?? null).toBe(vnpay);
    expect(config.momo?.mode ?? null).toBe(momo);
  });

  it('reports an unknown mode and a mode that lacks credentials', () => {
    const issues = paymentsConfigIssues({ VNPAY_MODE: 'live', MOMO_MODE: 'sandbox' });
    expect(issues.join('\n')).toMatch(/VNPAY_MODE must be off, sandbox or production/);
    expect(issues.join('\n')).toMatch(/MOMO_PARTNER_CODE/);
  });

  it('uses the sandbox URLs by default and lets the environment override them', () => {
    const config = paymentsConfig({
      ...sandboxEnv,
      VNPAY_MODE: 'sandbox',
      MOMO_MODE: 'sandbox',
      ...VNPAY_ENV,
      ...MOMO_ENV,
    });
    expect(config.vnpay).toMatchObject({
      payUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      apiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    });
    expect(config.momo).toMatchObject({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
      queryEndpoint: 'https://test-payment.momo.vn/v2/gateway/api/query',
    });
    const overridden = paymentsConfig({
      ...sandboxEnv,
      MOMO_MODE: 'sandbox',
      ...MOMO_ENV,
      MOMO_ENDPOINT: 'http://localhost:9000/create',
      MOMO_QUERY_ENDPOINT: 'http://localhost:9000/lookup',
    });
    expect(overridden.momo).toMatchObject({
      endpoint: 'http://localhost:9000/create',
      queryEndpoint: 'http://localhost:9000/lookup',
    });
  });

  it('refuses a sandbox gateway while APP_ENV=production, and says so', () => {
    const env = {
      APP_ENV: 'production',
      APP_URL: 'https://vcraft.example',
      PAYMENTS_SANDBOX_GATEWAYS: 'true',
      ...VNPAY_ENV,
      ...MOMO_ENV,
    };
    const config = paymentsConfig(env);
    expect(config.vnpay).toBeNull();
    expect(config.momo).toBeNull();
    expect(availableMethods(config)).toEqual([]);
    expect(paymentsConfigIssues(env).filter((i) => /sandbox mode/.test(i))).toHaveLength(2);
  });

  it('takes production URLs from the environment only, and needs https', () => {
    const config = paymentsConfig({ ...withAppUrl, ...vnpayProduction, ...momoProduction });
    expect(config.vnpay).toMatchObject({
      mode: 'production',
      payUrl: 'https://pay.vnpay.example/vpcpay.html',
      apiUrl: 'https://api.vnpay.example/merchant_webapi/api/transaction',
    });
    // The MoMo query endpoint is derived from the create endpoint.
    expect(config.momo).toMatchObject({
      mode: 'production',
      endpoint: 'https://payment.momo.example/v2/gateway/api/create',
      queryEndpoint: 'https://payment.momo.example/v2/gateway/api/query',
    });
    // Missing URLs: never fall back to a sandbox URL.
    const { VNPAY_API_URL: _api, ...noApi } = vnpayProduction;
    const { MOMO_ENDPOINT: _endpoint, ...noEndpoint } = momoProduction;
    const missing = { ...withAppUrl, ...noApi, ...noEndpoint };
    expect(paymentsConfig(missing).vnpay).toBeNull();
    expect(paymentsConfig(missing).momo).toBeNull();
    expect(paymentsConfigIssues(missing).join('\n')).toMatch(/VNPAY_API_URL/);
    expect(paymentsConfigIssues(missing).join('\n')).toMatch(/MOMO_ENDPOINT/);
    // Plain http URLs.
    const insecure = {
      ...withAppUrl,
      ...vnpayProduction,
      VNPAY_PAY_URL: 'http://pay.vnpay.example/vpcpay.html',
      ...momoProduction,
      MOMO_ENDPOINT: 'http://payment.momo.example/v2/gateway/api/create',
    };
    expect(paymentsConfig(insecure).vnpay).toBeNull();
    expect(paymentsConfig(insecure).momo).toBeNull();
    expect(paymentsConfigIssues(insecure).join('\n')).toMatch(/https/);
  });

  it('needs an https APP_URL for a production gateway', () => {
    const env = { APP_URL: 'http://vcraft.example', ...vnpayProduction };
    expect(paymentsConfig(env).vnpay).toBeNull();
    expect(paymentsConfigIssues(env).join('\n')).toMatch(/APP_URL/);
    expect(paymentsConfig({ ...vnpayProduction }).vnpay).toBeNull(); // the default localhost URL is not https
  });

  it('turns MoMo off in production when the query endpoint cannot be derived', () => {
    const env = {
      ...withAppUrl,
      ...momoProduction,
      MOMO_ENDPOINT: 'https://payment.momo.example/v2/gateway/api/pay',
    };
    expect(paymentsConfig(env).momo).toBeNull();
    expect(paymentsConfigIssues(env).join('\n')).toMatch(/MOMO_QUERY_ENDPOINT/);
    const explicit = { ...env, MOMO_QUERY_ENDPOINT: 'https://payment.momo.example/lookup' };
    expect(paymentsConfig(explicit).momo?.queryEndpoint).toBe(
      'https://payment.momo.example/lookup',
    );
  });

  it('reads the wallet expiry and the amount limits, falling back on bad values with an issue', () => {
    expect(paymentsConfig({}).walletExpiryMs).toBe(30 * 60_000);
    expect(paymentsConfig({ PAYMENT_WALLET_EXPIRES_IN_MINUTES: '45' }).walletExpiryMs).toBe(
      45 * 60_000,
    );
    const bad = {
      PAYMENT_WALLET_EXPIRES_IN_MINUTES: '0',
      VNPAY_MAX_AMOUNT_VND: 'lots',
      MOMO_MAX_AMOUNT_VND: '12.5',
    };
    const config = paymentsConfig(bad);
    expect(config.walletExpiryMs).toBe(30 * 60_000);
    expect(methodLimits(config)).toEqual({
      SEPAY_TRANSFER: { minVnd: 1, maxVnd: null },
      VNPAY: { minVnd: 5_000, maxVnd: 999_999_999 },
      MOMO: { minVnd: 1_000, maxVnd: 50_000_000 },
    });
    expect(paymentsConfigIssues(bad)).toHaveLength(3);
    const custom = paymentsConfig({
      VNPAY_MAX_AMOUNT_VND: '20000000',
      MOMO_MAX_AMOUNT_VND: '10000000',
    });
    expect(methodLimits(custom).VNPAY.maxVnd).toBe(20_000_000);
    expect(methodLimits(custom).MOMO.maxVnd).toBe(10_000_000);
  });

  it('never puts a secret value in an issue', () => {
    const env = {
      APP_ENV: 'production',
      APP_URL: 'http://vcraft.example',
      SEPAY_WEBHOOK_API_KEY: 'sepay-secret-value',
      VNPAY_MODE: 'production',
      VNPAY_TMN_CODE: 'tmn-secret-value',
      VNPAY_HASH_SECRET: 'vnpay-secret-value',
      MOMO_MODE: 'sandbox',
      MOMO_PARTNER_CODE: 'momo-partner-value',
      MOMO_ACCESS_KEY: 'momo-access-value',
      MOMO_SECRET_KEY: 'momo-secret-value',
    };
    const issues = paymentsConfigIssues(env).join('\n');
    expect(issues.length).toBeGreaterThan(0);
    for (const value of Object.values(env).filter((v) => /value$/.test(v))) {
      expect(issues).not.toContain(value);
    }
  });
});

describe('SePay gateway', () => {
  const gateway = new SepayGateway();
  const transfer = (overrides: Record<string, unknown> = {}) => ({
    id: 92704,
    gateway: 'MBBank',
    transactionDate: '2026-11-08 14:02:37',
    accountNumber: SEPAY_ENV.SEPAY_BANK_ACCOUNT_NUMBER,
    code: null,
    content: `MBVCB.123 ${snapshot.referenceCode} chuyen tien`,
    transferType: 'in',
    transferAmount: 3_000_000,
    accumulated: 19_077_000,
    subAccount: null,
    referenceCode: 'MB.3278907687',
    description: '',
    ...overrides,
  });

  it('builds the bank panel with a QR image and a VietQR payload for the exact amount', async () => {
    setEnv(SEPAY_ENV);
    const checkout = await gateway.createCheckout(snapshot);
    expect(checkout).toMatchObject({
      type: 'BANK_TRANSFER',
      bankName: 'MB Bank',
      accountNumber: '0123456789',
      transferContent: 'VCPAB3DEF7K9M',
    });
    if (checkout.type !== 'BANK_TRANSFER') throw new Error('unexpected checkout');
    const url = new URL(checkout.qrImageUrl as string);
    expect(url.origin + url.pathname).toBe('https://qr.sepay.vn/img');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      acc: '0123456789',
      bank: 'MBBank',
      amount: '3000000',
      des: 'VCPAB3DEF7K9M',
    });
    expect(checkout.qrPayload).toContain('0006970422');
    expect(checkout.qrPayload).toContain('0813VCPAB3DEF7K9M');
  });

  it('leaves the QR out when the bank code and BIN are not configured', async () => {
    setEnv(SEPAY_ENV);
    vi.stubEnv('SEPAY_BANK_CODE', '');
    vi.stubEnv('SEPAY_BANK_BIN', '');
    const checkout = await gateway.createCheckout(snapshot);
    expect(checkout).toMatchObject({ qrImageUrl: null, qrPayload: null });
  });

  it('rejects a missing, wrong or malformed Authorization header', () => {
    setEnv(SEPAY_ENV);
    for (const authorization of [
      undefined,
      '',
      'Apikey wrong',
      'Bearer sepay-test-key',
      'sepay-test-key',
    ]) {
      expect(gateway.verifyCallback({ authorization, body: transfer() })).toEqual({
        signatureValid: false,
        reason: 'BAD_API_KEY',
      });
    }
  });

  it('refuses every call while SePay is not configured', () => {
    expect(
      gateway.verifyCallback({ authorization: 'Apikey sepay-test-key', body: transfer() }),
    ).toMatchObject({ signatureValid: false });
  });

  it('reads an incoming transfer: reference from the content, SePay id as the transaction id', () => {
    setEnv(SEPAY_ENV);
    const verdict = gateway.verifyCallback({
      authorization: 'Apikey sepay-test-key',
      body: transfer(),
    });
    expect(verdict).toMatchObject({
      signatureValid: true,
      event: {
        provider: 'SEPAY',
        referenceCode: 'VCPAB3DEF7K9M',
        providerTxnId: '92704',
        amountVnd: 3_000_000,
        outcome: 'PAID',
      },
    });
  });

  it('prefers the payment code SePay detected over the free content', () => {
    setEnv(SEPAY_ENV);
    const verdict = gateway.verifyCallback({
      authorization: 'apikey sepay-test-key',
      body: transfer({ code: 'VCPZZ3DEF7K9M', content: 'unrelated' }),
    });
    expect(verdict).toMatchObject({ event: { referenceCode: 'VCPZZ3DEF7K9M' } });
  });

  it.each([
    ['an outgoing transfer', { transferType: 'out' }, 'OUTGOING_TRANSFER'],
    ['content without a payment code', { content: 'cafe' }, 'NO_PAYMENT_CODE'],
    ['another account', { accountNumber: '999' }, 'OTHER_ACCOUNT'],
    ['a malformed payload', { transferAmount: 'lots' }, 'MALFORMED_PAYLOAD'],
  ])('ignores %s but still acknowledges it', (_name, overrides, ignored) => {
    setEnv(SEPAY_ENV);
    expect(
      gateway.verifyCallback({ authorization: 'Apikey sepay-test-key', body: transfer(overrides) }),
    ).toEqual({ signatureValid: true, event: null, ignored });
  });
});

describe('VNPay gateway', () => {
  // The legacy flag switches the sandbox mode on for credentials that come without an explicit mode.
  beforeEach(() => vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'true'));
  const gateway = new VnpayGateway();
  const signedQuery = (fields: Record<string, string>) => {
    // Independent of the adapter: the documented scheme, sorted `key=value` joined by `&`, HMAC-SHA512.
    const data = Object.keys(fields)
      .sort()
      .map((key) => `${key}=${encodeURIComponent(fields[key] as string).replace(/%20/g, '+')}`)
      .join('&');
    return {
      ...fields,
      vnp_SecureHash: createHmac('sha512', VNPAY_ENV.VNPAY_HASH_SECRET)
        .update(data, 'utf8')
        .digest('hex'),
    };
  };
  const ipn = (overrides: Record<string, string> = {}) =>
    signedQuery({
      vnp_TmnCode: VNPAY_ENV.VNPAY_TMN_CODE,
      vnp_Amount: '300000000',
      vnp_BankCode: 'NCB',
      vnp_OrderInfo: 'vCraft VCPAB3DEF7K9M',
      vnp_PayDate: '20261108210000',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: snapshot.referenceCode,
      ...overrides,
    });

  it('formats VNPay dates in Vietnam time', () => {
    expect(vnpayDate(new Date('2026-11-08T17:30:05Z'))).toBe('20261109003005');
  });

  it('builds a signed payment URL that verifies against its own query', async () => {
    setEnv({ ...VNPAY_ENV, APP_URL: 'https://vcraft.example' });
    const checkout = await gateway.createCheckout(snapshot);
    if (checkout.type !== 'REDIRECT') throw new Error('unexpected checkout');
    const url = new URL(checkout.url);
    expect(url.origin + url.pathname).toBe('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html');
    const query = Object.fromEntries(url.searchParams) as Record<string, string>;
    expect(query).toMatchObject({
      vnp_TmnCode: 'TESTTMN1',
      vnp_Amount: '300000000',
      vnp_TxnRef: 'VCPAB3DEF7K9M',
      vnp_CurrCode: 'VND',
      vnp_ReturnUrl: 'https://vcraft.example/api/v1/payments/return/vnpay',
      vnp_ExpireDate: '20261109170000',
    });
    // The URL's own signature is the one VNPay will recompute on its side.
    expect(gateway.verifyCallback({ ...query, vnp_ResponseCode: '00' }).signatureValid).toBe(false); // adding a field after signing breaks it
    const { vnp_SecureHash, ...unsigned } = query;
    const expected = signedQuery(unsigned).vnp_SecureHash;
    expect(vnp_SecureHash).toBe(expected);
  });

  it('accepts a correctly signed successful IPN and converts the x100 amount', () => {
    setEnv(VNPAY_ENV);
    expect(gateway.verifyCallback(ipn())).toMatchObject({
      signatureValid: true,
      event: {
        provider: 'VNPAY',
        referenceCode: 'VCPAB3DEF7K9M',
        providerTxnId: '14123456',
        amountVnd: 3_000_000,
        outcome: 'PAID',
      },
    });
  });

  it('reads a declined payment as a failure', () => {
    setEnv(VNPAY_ENV);
    const verdict = gateway.verifyCallback(
      ipn({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' }),
    );
    expect(verdict).toMatchObject({ signatureValid: true, event: { outcome: 'FAILED' } });
  });

  it('rejects a tampered amount, a wrong secret and a missing hash', () => {
    setEnv(VNPAY_ENV);
    const good = ipn();
    expect(gateway.verifyCallback({ ...good, vnp_Amount: '100' })).toEqual({
      signatureValid: false,
      reason: 'BAD_SIGNATURE',
    });
    vi.stubEnv('VNPAY_HASH_SECRET', 'another-secret');
    expect(gateway.verifyCallback(good)).toMatchObject({ signatureValid: false });
    vi.stubEnv('VNPAY_HASH_SECRET', VNPAY_ENV.VNPAY_HASH_SECRET);
    const { vnp_SecureHash: _hash, ...bare } = good;
    expect(gateway.verifyCallback(bare)).toEqual({
      signatureValid: false,
      reason: 'MALFORMED_QUERY',
    });
  });

  it('never matches an amount that is not a whole VND', () => {
    setEnv(VNPAY_ENV);
    const verdict = gateway.verifyCallback(ipn({ vnp_Amount: '300000050' }));
    expect(verdict).toMatchObject({ signatureValid: true });
    if (verdict.signatureValid && verdict.event) expect(verdict.event.amountVnd).toBeNaN();
  });
});

describe('MoMo gateway', () => {
  beforeEach(() => vi.stubEnv('PAYMENTS_SANDBOX_GATEWAYS', 'true'));
  const sign = (data: string) =>
    createHmac('sha256', MOMO_ENV.MOMO_SECRET_KEY).update(data, 'utf8').digest('hex');
  const ipn = (overrides: Record<string, string | number> = {}) => {
    const fields = {
      partnerCode: 'MOMOTEST',
      orderId: snapshot.referenceCode,
      requestId: 'req-1',
      amount: 3_000_000,
      orderInfo: 'vCraft VCPAB3DEF7K9M',
      orderType: 'momo_wallet',
      transId: 4_100_000_001,
      resultCode: 0,
      message: 'Successful.',
      payType: 'qr',
      responseTime: 1_762_600_000_000,
      extraData: '',
      ...overrides,
    };
    // The documented signing string: alphabetical, `accessKey` first.
    const raw =
      `accessKey=${MOMO_ENV.MOMO_ACCESS_KEY}&amount=${fields.amount}&extraData=${fields.extraData}` +
      `&message=${fields.message}&orderId=${fields.orderId}&orderInfo=${fields.orderInfo}` +
      `&orderType=${fields.orderType}&partnerCode=${fields.partnerCode}&payType=${fields.payType}` +
      `&requestId=${fields.requestId}&responseTime=${fields.responseTime}` +
      `&resultCode=${fields.resultCode}&transId=${fields.transId}`;
    return { ...fields, signature: sign(raw) };
  };

  function fakeHttp(reply: Record<string, unknown>, ok = true) {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const http: PaymentHttp = async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok, status: ok ? 200 : 500, json: async () => reply };
    };
    return { http, calls };
  }

  it('creates a captureWallet payment with a signature MoMo can recompute', async () => {
    setEnv({ ...MOMO_ENV, APP_URL: 'https://vcraft.example' });
    const { http, calls } = fakeHttp({
      resultCode: 0,
      payUrl: 'https://test-payment.momo.vn/pay/1',
      deeplink: 'momo://pay/1',
      qrCodeUrl: 'momo://qr/1',
    });
    const checkout = await new MomoGateway(http).createCheckout(snapshot);
    expect(checkout).toEqual({
      type: 'REDIRECT',
      url: 'https://test-payment.momo.vn/pay/1',
      deeplink: 'momo://pay/1',
      qrImageUrl: 'momo://qr/1',
    });
    const [call] = calls;
    expect(call?.url).toBe('https://test-payment.momo.vn/v2/gateway/api/create');
    const body = call?.body as Record<string, string | number>;
    expect(body).toMatchObject({
      partnerCode: 'MOMOTEST',
      orderId: 'VCPAB3DEF7K9M',
      amount: 3_000_000,
      requestType: 'captureWallet',
      ipnUrl: 'https://vcraft.example/api/v1/payments/webhooks/momo',
      redirectUrl: 'https://vcraft.example/api/v1/payments/return/momo',
    });
    const raw =
      `accessKey=access-key&amount=${body.amount}&extraData=${body.extraData}&ipnUrl=${body.ipnUrl}` +
      `&orderId=${body.orderId}&orderInfo=${body.orderInfo}&partnerCode=${body.partnerCode}` +
      `&redirectUrl=${body.redirectUrl}&requestId=${body.requestId}&requestType=${body.requestType}`;
    expect(body.signature).toBe(sign(raw));
  });

  it('fails the checkout when MoMo refuses', async () => {
    setEnv(MOMO_ENV);
    const { http } = fakeHttp({ resultCode: 1003 });
    await expect(new MomoGateway(http).createCheckout(snapshot)).rejects.toThrow(/refused/);
  });

  it('accepts a correctly signed IPN', () => {
    setEnv(MOMO_ENV);
    const gateway = new MomoGateway(fakeHttp({}).http);
    expect(gateway.verifyCallback(ipn())).toMatchObject({
      signatureValid: true,
      event: {
        provider: 'MOMO',
        referenceCode: 'VCPAB3DEF7K9M',
        providerTxnId: '4100000001',
        amountVnd: 3_000_000,
        outcome: 'PAID',
      },
    });
    expect(gateway.verifyCallback(ipn({ resultCode: 1006, message: 'Declined' }))).toMatchObject({
      event: { outcome: 'FAILED' },
    });
  });

  it('rejects a tampered amount, a wrong partner and a forged signature', () => {
    setEnv(MOMO_ENV);
    const gateway = new MomoGateway(fakeHttp({}).http);
    expect(gateway.verifyCallback({ ...ipn(), amount: 1 })).toMatchObject({
      signatureValid: false,
      reason: 'BAD_SIGNATURE',
    });
    expect(gateway.verifyCallback(ipn({ partnerCode: 'OTHER' }))).toMatchObject({
      signatureValid: false,
      reason: 'WRONG_PARTNER',
    });
    expect(gateway.verifyCallback({ ...ipn(), signature: 'abc' })).toMatchObject({
      signatureValid: false,
    });
    expect(gateway.verifyCallback({})).toMatchObject({ signatureValid: false });
  });
});
