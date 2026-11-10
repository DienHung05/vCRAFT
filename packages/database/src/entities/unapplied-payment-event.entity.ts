import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { PaymentProvider } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { Payment } from './payment.entity.js';
import { QuotationRequest } from './quotation-request.entity.js';

export const UNAPPLIED_PAYMENT_REASONS = [
  /** The transfer amount differs from the amount the payment asks for. */
  'AMOUNT_MISMATCH',
  /** The payment it names is cancelled or failed, so it cannot take the money. */
  'PAYMENT_NOT_PAYABLE',
  /** The order already has a paid payment of the same kind. */
  'ORDER_ALREADY_PAID',
  /** The payment it names is already paid or refunded (a second, different transfer). */
  'PAYMENT_ALREADY_SETTLED',
] as const;
export type UnappliedPaymentReason = (typeof UNAPPLIED_PAYMENT_REASONS)[number];

export type UnappliedPaymentStatus = 'OPEN' | 'RESOLVED';

/**
 * Money a provider says arrived but that no payment could take (GH#417): a wrong amount, a transfer to a
 * cancelled or failed payment, a second payment of the same kind. Each such transfer is kept as its own row
 * (never overwritten by the next event) until an administrator has dealt with it by hand and marks it
 * `RESOLVED` with a note. `(provider, providerTxnId)` is unique, so a webhook retry does not add a second row.
 * `payment` and `order` are the references the transfer named; no money has been applied to either.
 */
@Entity({ tableName: 'unapplied_payment_event' })
@Unique({ properties: ['provider', 'providerTxnId'] })
@Index({ properties: ['status', 'createdAt'] })
export class UnappliedPaymentEvent extends BaseEntity {
  @Property({ type: 'string', length: 20 })
  provider!: PaymentProvider;

  @Property({ type: 'string', length: 100 })
  providerTxnId!: string;

  @Property({ type: new BigIntType('number') })
  amountVnd!: number;

  /** The provider event as received, for diagnosis. */
  @Property({ type: 'json', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @ManyToOne({ entity: () => Payment, fieldName: 'payment_id', nullable: true })
  payment?: Payment | null;

  @ManyToOne({ entity: () => QuotationRequest, fieldName: 'order_id', nullable: true })
  order?: QuotationRequest | null;

  @Property({ type: 'string', length: 40 })
  reason!: UnappliedPaymentReason;

  @Property({ type: 'string', length: 20 })
  status: Opt<UnappliedPaymentStatus> = 'OPEN';

  @Property({ type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  resolvedAt?: Date | null;

  @Property({ type: 'string', length: 500, nullable: true })
  resolvedNote?: string | null;
}
