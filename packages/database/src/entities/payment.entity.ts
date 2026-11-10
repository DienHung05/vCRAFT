import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { PaymentKind, PaymentMethod, PaymentProvider, PaymentStatus } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { QuotationRequest } from './quotation-request.entity.js';

/** How the buyer pays, kept on the row so a repeat read shows the same bank details or redirect link. */
export type PaymentCheckoutData =
  | {
      type: 'BANK_TRANSFER';
      bankName: string;
      accountNumber: string;
      accountName: string;
      transferContent: string;
      qrImageUrl: string | null;
      qrPayload: string | null;
    }
  | { type: 'REDIRECT'; url: string; deeplink: string | null; qrImageUrl: string | null };

/**
 * One payment of an order (ADR-0021, GH#205): the deposit or the balance of an accepted quotation, in whole
 * VND. The order is the quotation request. `referenceCode` goes into the transfer content, `vnp_TxnRef` or the
 * MoMo `orderId`; `(provider, providerTxnId)` is unique so each provider event is applied once. `status`
 * follows the payment state machine in `@vcraft/domain`. `OFFLINE` payments have no provider and no expiry.
 */
@Entity({ tableName: 'payment' })
@Unique({ properties: ['referenceCode'] })
@Unique({ properties: ['provider', 'providerTxnId'] })
@Index({ properties: ['order', 'kind', 'status'] })
@Index({ properties: ['status', 'expiresAt'] })
@Index({ properties: ['createdAt'] })
export class Payment extends BaseEntity {
  @ManyToOne({ entity: () => QuotationRequest, fieldName: 'order_id' })
  order!: QuotationRequest;

  @Property({ type: 'string', length: 20 })
  kind!: PaymentKind;

  @Property({ type: 'string', length: 20 })
  method!: PaymentMethod;

  @Property({ type: 'string', length: 20, nullable: true })
  provider?: PaymentProvider | null;

  @Property({ type: new BigIntType('number') })
  amountVnd!: number;

  @Property({ type: 'string', length: 40 })
  referenceCode!: string;

  @Property({ type: 'string', length: 100, nullable: true })
  providerTxnId?: string | null;

  @Property({ type: 'string', length: 20 })
  status: Opt<PaymentStatus> = 'PENDING';

  @Property({ type: 'datetime', length: 3, nullable: true })
  expiresAt?: Date | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  paidAt?: Date | null;

  /** The last provider event as received (webhook body, IPN query), for diagnosis. Never shown to buyers. */
  @Property({ type: 'json', nullable: true })
  rawLastEvent?: Record<string, unknown> | null;

  @Property({ type: 'json', nullable: true })
  checkout?: PaymentCheckoutData | null;

  /** The administrator who recorded an offline payment. */
  @Property({ type: 'uuid', nullable: true })
  recordedBy?: string | null;

  @Property({ type: 'string', length: 500, nullable: true })
  note?: string | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  refundedAt?: Date | null;

  @Property({ type: 'uuid', nullable: true })
  refundedBy?: string | null;

  @Property({ type: 'string', length: 500, nullable: true })
  refundReason?: string | null;

  /**
   * Set when the order was cancelled while this payment was paid: the money is owed back until an administrator
   * marks it refunded (GH#417).
   */
  @Property({ type: 'datetime', length: 3, nullable: true })
  refundDueAt?: Date | null;
}
