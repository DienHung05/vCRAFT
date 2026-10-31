import { BigIntType, type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import type { ProductCategory, RfqStatus } from '@vcraft/domain';
import { AppUser } from './app-user.entity.js';
import { BaseEntity } from './base.entity.js';

@Entity({ tableName: 'quotation_request' })
@Index({ properties: ['buyer', 'status'] })
export class QuotationRequest extends BaseEntity {
  @ManyToOne({ entity: () => AppUser })
  buyer!: AppUser;

  @Property({ type: 'uuid', nullable: true })
  coordinatorId?: string | null;

  @Property({ type: 'integer' })
  revision: Opt<number> = 0;

  /** Empty on requests created before the buyer form had a title. */
  @Property({ type: 'string', length: 200, nullable: true })
  title?: string | null;

  @Property({ type: 'string', length: 20, nullable: true })
  category?: ProductCategory | null;

  @Property({ type: 'string', length: 500 })
  design!: string;

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'string', length: 30 })
  unit!: string;

  @Property({ type: 'string', length: 300 })
  destination!: string;

  @Property({ type: new BigIntType('number'), nullable: true })
  budgetMinVnd?: number | null;

  @Property({ type: new BigIntType('number'), nullable: true })
  budgetMaxVnd?: number | null;

  @Property({ type: 'string', length: 500, nullable: true })
  cancelReason?: string | null;

  @Property({ type: 'datetime', length: 3 })
  requiredBy!: Date;

  @Property({ type: 'datetime', length: 3 })
  biddingClosesAt!: Date;

  @Property({ type: 'json' })
  invitedHouseholdIds: string[] = [];

  /** Invited households that said no. Never sent to other households or to the buyer. */
  @Property({ type: 'json', nullable: true })
  declinedHouseholdIds?: string[] | null;

  @Property({ type: 'boolean' })
  coordinationOptIn: Opt<boolean> = false;

  @Property({ type: 'string', length: 20 })
  status: Opt<RfqStatus> = 'DRAFT';
}
