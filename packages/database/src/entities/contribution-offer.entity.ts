import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';
import { QuotationRequest } from './quotation-request.entity.js';

@Entity({ tableName: 'contribution_offer' })
@Index({ properties: ['request', 'status'] })
@Unique({ properties: ['request', 'household'] })
export class ContributionOffer extends BaseEntity {
  @ManyToOne({ entity: () => QuotationRequest })
  request!: QuotationRequest;

  @ManyToOne({ entity: () => Household })
  household!: Household;

  @Property({ type: 'integer' })
  maxQuantity!: number;

  @Property({ type: new BigIntType('number') })
  unitPriceVnd!: number;

  @Property({ type: 'datetime', length: 3 })
  completionDate!: Date;

  @Property({ type: 'string', length: 20 })
  status: Opt<'ACTIVE' | 'WITHDRAWN'> = 'ACTIVE';

  @Property({ type: 'json' })
  history: Opt<
    Array<{
      version: number;
      maxQuantity: number;
      unitPriceVnd: number;
      completionDate: string;
      status: 'ACTIVE' | 'WITHDRAWN';
    }>
  > = [];
}
