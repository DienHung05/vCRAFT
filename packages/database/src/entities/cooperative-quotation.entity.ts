import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import type { BidStatus, BidType, DeliveryTerms } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { QuotationRequest } from './quotation-request.entity.js';

@Entity({ tableName: 'cooperative_quotation' })
@Index({ properties: ['request', 'status'] })
export class CooperativeQuotation extends BaseEntity {
  @ManyToOne({ entity: () => QuotationRequest })
  request!: QuotationRequest;

  @Property({ type: 'string', length: 20 })
  status: Opt<BidStatus> = 'SUBMITTED';

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'json' })
  parts!: Array<{
    householdId: string;
    quantity: number;
    unitPriceVnd: number;
    completionDate: string;
    contributionVersion: number;
  }>;

  @Property({ type: new BigIntType('number') })
  productionTotalVnd!: number;

  @Property({ type: new BigIntType('number'), ignoreSchemaChanges: ['default'] })
  additionalChargeVnd: Opt<number> = 0;

  @Property({ type: new BigIntType('number') })
  totalVnd!: number;

  @Property({ type: 'string', length: 20 })
  deliveryTerms!: DeliveryTerms;

  @Property({ type: 'string', length: 20 })
  bidType: Opt<BidType> = 'COOPERATIVE';

  /** Free note a household adds to its own (`INDIVIDUAL`) quotation. */
  @Property({ type: 'string', length: 500, nullable: true })
  note?: string | null;
}
