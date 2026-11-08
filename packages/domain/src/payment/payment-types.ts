/**
 * Online payment of orders (ADR-0021, GH#205). An order is an accepted quotation; it takes two payments,
 * a deposit before production and the balance before delivery. Amounts are whole VND.
 */
export const PAYMENT_KINDS = ['DEPOSIT', 'BALANCE'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/**
 * How the buyer pays. `SEPAY_TRANSFER` is a bank transfer to the village administration's account, with a
 * VietQR image of the same transfer; the money is confirmed by a SePay bank-account webhook. `OFFLINE` is
 * entered by hand by an administrator (the balance only) and never touches a gateway.
 */
export const PAYMENT_METHODS = ['SEPAY_TRANSFER', 'VNPAY', 'MOMO', 'OFFLINE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The party that confirms the money; `null` for `OFFLINE`. */
export const PAYMENT_PROVIDERS = ['SEPAY', 'VNPAY', 'MOMO'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Methods the buyer can start online; `OFFLINE` is administrator-only. */
export const ONLINE_PAYMENT_METHODS = ['SEPAY_TRANSFER', 'VNPAY', 'MOMO'] as const;
export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

/** Methods whose gateway is a direct sandbox integration, hidden unless the feature flag is on. */
export const SANDBOX_GATEWAY_METHODS = ['VNPAY', 'MOMO'] as const;

export const PAYMENT_STATUSES = [
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function providerOf(method: PaymentMethod): PaymentProvider | null {
  switch (method) {
    case 'SEPAY_TRANSFER':
      return 'SEPAY';
    case 'VNPAY':
      return 'VNPAY';
    case 'MOMO':
      return 'MOMO';
    case 'OFFLINE':
      return null;
  }
}

/** How long a pending payment waits for the money before the worker expires it (ADR-0021: 24 h). */
export const PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;
