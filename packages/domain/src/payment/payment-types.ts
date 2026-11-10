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

/**
 * Why money that arrived could not be applied to its payment (GH#417). Each case keeps its own record and
 * waits for an administrator to give the money back or settle it by hand.
 * - `AMOUNT_MISMATCH`: the transfer was not the exact amount of the payment.
 * - `PAYMENT_NOT_PENDING`: the payment was already cancelled or failed when the money came.
 * - `ALREADY_PAID`: the order already has a paid payment of this kind, or this payment was settled before.
 */
export const UNAPPLIED_PAYMENT_REASONS = [
  'AMOUNT_MISMATCH',
  'PAYMENT_NOT_PENDING',
  'ALREADY_PAID',
] as const;
export type UnappliedPaymentReason = (typeof UNAPPLIED_PAYMENT_REASONS)[number];

/** An unapplied-money record is open until an administrator records how it was handled. */
export const UNAPPLIED_PAYMENT_STATUSES = ['OPEN', 'RESOLVED'] as const;
export type UnappliedPaymentStatus = (typeof UNAPPLIED_PAYMENT_STATUSES)[number];

/** How long a pending payment waits for the money before the worker expires it (ADR-0021: 24 h). */
export const PAYMENT_EXPIRY_MS = 24 * 60 * 60 * 1000;
