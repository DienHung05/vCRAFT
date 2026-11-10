import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type {
  PaymentProvider,
  UnappliedPaymentReason,
  UnappliedPaymentStatus,
} from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { Payment } from './payment.entity.js';

/**
 * Money a provider reported that could not be applied to its payment (GH#417): a wrong amount, a transfer to a
 * cancelled or failed payment, or a second payment of an order already paid. One row per provider transaction
 * (`(provider, providerTxnId)` is unique, so a webhook retry adds nothing), never overwritten by later events.
 * It stays `OPEN` until an administrator records how the money was handled.
 */
@Entity({ tableName: 'unapplied_payment' })
@Unique({ properties: ['provider', 'providerTxnId'] })
@Index({ properties: ['status', 'createdAt'] })
export class UnappliedPayment extends BaseEntity {
  /** The payment the reference code named. */
  @ManyToOne({ entity: () => Payment, nullable: true })
  payment?: Payment | null;

  @Property({ type: 'string', length: 20 })
  provider!: PaymentProvider;

  @Property({ type: 'string', length: 100 })
  providerTxnId!: string;

  @Property({ type: 'string', length: 40 })
  referenceCode!: string;

  @Property({ type: new BigIntType('number') })
  amountVnd!: number;

  /** What the payment expected, for an amount mismatch. */
  @Property({ type: new BigIntType('number'), nullable: true })
  expectedAmountVnd?: number | null;

  @Property({ type: 'string', length: 30 })
  reason!: UnappliedPaymentReason;

  /** The provider event as received, for diagnosis. Scrubbed when the buyer deletes their account. */
  @Property({ type: 'json', nullable: true })
  raw?: Record<string, unknown> | null;

  @Property({ type: 'string', length: 20 })
  status: Opt<UnappliedPaymentStatus> = 'OPEN';

  @Property({ type: 'datetime', length: 3, nullable: true })
  resolvedAt?: Date | null;

  @Property({ type: 'uuid', nullable: true })
  resolvedBy?: string | null;

  /** How the money was handled: given back, applied by hand. */
  @Property({ type: 'string', length: 500, nullable: true })
  resolution?: string | null;
}
