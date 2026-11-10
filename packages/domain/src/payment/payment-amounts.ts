import type { RfqStatus } from '../rfq/rfq-types';
import { DomainError } from '../shared/domain-error';
import type { PaymentKind } from './payment-types';

/** Owner decision (GH#194): the deposit is 30 % of the order total unless a deployment says otherwise. */
export const DEFAULT_DEPOSIT_PERCENT = 30;

export type PaymentAmountCode = 'INVALID_DEPOSIT_PERCENT' | 'INVALID_ORDER_TOTAL';

/** A configured deposit share is a whole percent from 1 to 99, so both the deposit and the balance stay positive. */
export function isValidDepositPercent(percent: number): boolean {
  return Number.isInteger(percent) && percent >= 1 && percent <= 99;
}

/**
 * The deposit of an order: `percent` % of the total, rounded half up to a whole VND, never below 1 and
 * never above the total. Integer arithmetic only, so no float error creeps into money.
 */
export function depositAmountVnd(totalVnd: number, percent = DEFAULT_DEPOSIT_PERCENT): number {
  if (!Number.isSafeInteger(totalVnd) || totalVnd < 1) {
    throw new DomainError<PaymentAmountCode>(
      'INVALID_ORDER_TOTAL',
      'Order total must be a positive whole VND',
    );
  }
  if (!isValidDepositPercent(percent)) {
    throw new DomainError<PaymentAmountCode>(
      'INVALID_DEPOSIT_PERCENT',
      'Deposit share must be a whole percent from 1 to 99',
    );
  }
  // Split the product so that `total * percent` cannot pass Number.MAX_SAFE_INTEGER for very large totals.
  const whole = Math.floor(totalVnd / 100) * percent;
  const rest = totalVnd % 100;
  const fraction = Math.floor((rest * percent + 50) / 100);
  return Math.min(Math.max(whole + fraction, 1), totalVnd);
}

/** What the order still owes after the deposit. */
export function balanceAmountVnd(totalVnd: number, depositVnd: number): number {
  return totalVnd - depositVnd;
}

/**
 * The amount of a payment of `kind`. A balance is the total minus the deposit actually PAID: when no deposit
 * was paid (production may start without one when no deposit is required) it is the whole total. Pass
 * `paidDepositVnd` as the paid deposit, or leave it out when none was paid.
 */
export function paymentAmountVnd(
  kind: PaymentKind,
  totalVnd: number,
  percent = DEFAULT_DEPOSIT_PERCENT,
  paidDepositVnd?: number,
): number {
  if (kind === 'DEPOSIT') return paidDepositVnd ?? depositAmountVnd(totalVnd, percent);
  return balanceAmountVnd(totalVnd, paidDepositVnd ?? 0);
}

/** An incoming amount settles a payment only when it equals the expected amount exactly (ADR-0021 rules). */
export function amountsMatch(expectedVnd: number, receivedVnd: number): boolean {
  return Number.isSafeInteger(receivedVnd) && receivedVnd === expectedVnd;
}

export type PaymentEligibilityCode =
  | 'PAYMENT_ORDER_NOT_PAYABLE'
  | 'PAYMENT_ALREADY_PAID'
  | 'PAYMENT_DEPOSIT_REQUIRED';

export interface PaymentEligibilityInput {
  readonly kind: PaymentKind;
  readonly requestStatus: RfqStatus;
  readonly depositPaid: boolean;
  readonly balancePaid: boolean;
  /** Whether production is gated on a paid deposit in this deployment. */
  readonly depositRequired: boolean;
}

/**
 * Whether the order can take a payment of this kind now (undefined means yes). The deposit is paid while the
 * order waits for production (`ACCEPTED`), and, when no deposit is required, also late (`IN_PRODUCTION`,
 * `DELIVERED`) so the order can still be paid in the usual split. The balance is paid from `ACCEPTED` on, until
 * delivery is confirmed, and after a deposit when a deposit is required.
 */
export function paymentEligibility(
  input: PaymentEligibilityInput,
): DomainError<PaymentEligibilityCode> | undefined {
  if (input.kind === 'DEPOSIT') {
    if (input.depositPaid)
      return new DomainError('PAYMENT_ALREADY_PAID', 'The deposit is already paid');
    const late =
      !input.depositRequired &&
      (input.requestStatus === 'IN_PRODUCTION' || input.requestStatus === 'DELIVERED');
    return input.requestStatus === 'ACCEPTED' || late
      ? undefined
      : new DomainError(
          'PAYMENT_ORDER_NOT_PAYABLE',
          'The deposit is paid before production starts',
        );
  }
  if (input.balancePaid)
    return new DomainError('PAYMENT_ALREADY_PAID', 'The balance is already paid');
  if (!['ACCEPTED', 'IN_PRODUCTION', 'DELIVERED'].includes(input.requestStatus)) {
    return new DomainError('PAYMENT_ORDER_NOT_PAYABLE', 'The order is not accepted');
  }
  if (input.depositRequired && !input.depositPaid) {
    return new DomainError('PAYMENT_DEPOSIT_REQUIRED', 'Pay the deposit before the balance');
  }
  return undefined;
}
