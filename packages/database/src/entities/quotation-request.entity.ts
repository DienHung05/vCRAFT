import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import type { RfqStatus } from '@vcraft/domain';
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

  @Property({ type: 'string', length: 500 })
  design!: string;

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'string', length: 30 })
  unit!: string;

  @Property({ type: 'string', length: 300 })
  destination!: string;

  @Property({ type: 'datetime', length: 3 })
  requiredBy!: Date;

  @Property({ type: 'datetime', length: 3 })
  biddingClosesAt!: Date;

  @Property({ type: 'json' })
  invitedHouseholdIds: string[] = [];

  @Property({ type: 'boolean' })
  coordinationOptIn: Opt<boolean> = false;

  @Property({ type: 'string', length: 20 })
  status: Opt<RfqStatus> = 'DRAFT';
}
