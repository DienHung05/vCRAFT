import { DomainError } from '../shared/domain-error';
import { createStateMachine, type Guard, type TransitionTable } from '../shared/state-machine';
import { amountsMatch } from './payment-amounts';
import { PAYMENT_STATUSES, type PaymentStatus } from './payment-types';

/**
 * Payment state machine (ADR-0021), implemented once and shared by the API and the worker.
 *
 * `PENDING` → `PAID` | `FAILED` | `EXPIRED` | `CANCELLED`; `PAID` → `REFUNDED` (administrator only, manual,
 * no gateway call). A transfer that arrives after the payment expired still counts (`EXPIRED` → `PAID`),
 * because the money is already in the account; the amount and the reference must match all the same.
 */
export const PAYMENT_EVENTS = ['CONFIRM', 'FAIL', 'EXPIRE', 'CANCEL', 'REFUND'] as const;
export type PaymentEvent = (typeof PAYMENT_EVENTS)[number];

/**
 * Who causes the event: `SYSTEM` is a verified provider webhook or the worker, `BUYER_OWNER` the buyer of the
 * order, `ADMIN` an administrator.
 */
export const PAYMENT_ACTORS = ['SYSTEM', 'BUYER_OWNER', 'ADMIN'] as const;
export type PaymentActor = (typeof PAYMENT_ACTORS)[number];

export type PaymentGuardCode =
  | 'MISSING_CONTEXT'
  | 'ACTOR_NOT_ALLOWED'
  | 'PAYMENT_AMOUNT_MISMATCH'
  | 'NOT_YET_EXPIRED'
  | 'REASON_REQUIRED';

export interface PaymentContext {
  readonly actor?: PaymentActor | undefined;
  readonly now?: Date | undefined;
  readonly expiresAt?: Date | undefined;
  /** CONFIRM: the amount the payment asks for, and the amount the provider says it received. */
  readonly expectedAmountVnd?: number | undefined;
  readonly receivedAmountVnd?: number | undefined;
  /** REFUND: why the money goes back. */
  readonly reason?: string | undefined;
}

type PaymentGuard = Guard<PaymentContext, PaymentGuardCode>;

const missing = (...fields: string[]) =>
  new DomainError<PaymentGuardCode>('MISSING_CONTEXT', `Missing context: ${fields.join(', ')}`, {
    fields,
  });

const actorIn =
  (...allowed: readonly PaymentActor[]): PaymentGuard =>
  (ctx) => {
    if (ctx.actor === undefined) return missing('actor');
    return allowed.includes(ctx.actor)
      ? undefined
      : new DomainError('ACTOR_NOT_ALLOWED', `Actor ${ctx.actor} cannot perform this event`, {
          actor: ctx.actor,
          allowed,
        });
  };

/** CONFIRM: the received amount equals the expected amount exactly. */
const amountMatches: PaymentGuard = (ctx) => {
  if (ctx.expectedAmountVnd === undefined || ctx.receivedAmountVnd === undefined) {
    return missing('expectedAmountVnd', 'receivedAmountVnd');
  }
  return amountsMatch(ctx.expectedAmountVnd, ctx.receivedAmountVnd)
    ? undefined
    : new DomainError(
        'PAYMENT_AMOUNT_MISMATCH',
        'Received amount differs from the expected amount',
        {
          expectedAmountVnd: ctx.expectedAmountVnd,
          receivedAmountVnd: ctx.receivedAmountVnd,
        },
      );
};

/** EXPIRE: `now ≥ expiresAt`. */
const expiryReached: PaymentGuard = (ctx) => {
  if (ctx.now === undefined || ctx.expiresAt === undefined) return missing('now', 'expiresAt');
  return ctx.now.getTime() >= ctx.expiresAt.getTime()
    ? undefined
    : new DomainError('NOT_YET_EXPIRED', 'The payment has not reached its expiry time');
};

/** REFUND: a reason is recorded with the refund. */
const refundReasonProvided: PaymentGuard = (ctx) => {
  if (ctx.reason === undefined) return missing('reason');
  return ctx.reason.trim().length > 0
    ? undefined
    : new DomainError('REASON_REQUIRED', 'A refund reason is required');
};

export const PAYMENT_TRANSITIONS = {
  PENDING: {
    CONFIRM: { to: 'PAID', guards: [actorIn('SYSTEM', 'ADMIN'), amountMatches] },
    FAIL: { to: 'FAILED', guards: [actorIn('SYSTEM')] },
    EXPIRE: { to: 'EXPIRED', guards: [actorIn('SYSTEM'), expiryReached] },
    CANCEL: { to: 'CANCELLED', guards: [actorIn('BUYER_OWNER', 'ADMIN')] },
  },
  EXPIRED: {
    CONFIRM: { to: 'PAID', guards: [actorIn('SYSTEM'), amountMatches] },
  },
  PAID: {
    REFUND: { to: 'REFUNDED', guards: [actorIn('ADMIN')], inputGuards: [refundReasonProvided] },
  },
  FAILED: {},
  CANCELLED: {},
  REFUNDED: {},
} as const satisfies TransitionTable<PaymentStatus, PaymentEvent, PaymentContext, PaymentGuardCode>;

const paymentMachine = createStateMachine<
  PaymentStatus,
  PaymentEvent,
  PaymentContext,
  PaymentGuardCode
>({
  name: 'Payment',
  states: PAYMENT_STATUSES,
  events: PAYMENT_EVENTS,
  table: PAYMENT_TRANSITIONS,
});

/** Always runs the guards; `ctx` is required (pass `{}` when the event needs no facts). */
export const paymentTransition = paymentMachine.transition;
export const availablePaymentEvents = paymentMachine.availableEvents;
/** Structure of the table only (SRS-style), NOT guards: never use it to allow an action. */
export const paymentStructuralNext = paymentMachine.structuralNext;
export const paymentStructuralEvents = paymentMachine.structuralEvents;
export const isPaymentFinal = paymentMachine.isTerminal;
