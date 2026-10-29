import { type Opt } from '@mikro-orm/core';
import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/** Private inbox record written in the same transaction as quotation invalidation. */
@Entity({ tableName: 'quotation_notice' })
@Index({ properties: ['recipientId', 'createdAt'] })
export class QuotationNotice extends BaseEntity {
  @Property({ type: 'uuid' })
  recipientId!: string;

  @Property({ type: 'uuid' })
  requestId!: string;

  @Property({ type: 'uuid' })
  quotationId!: string;

  @Property({ type: 'string', length: 40 })
  kind: Opt<'QUOTATION_WITHDRAWN'> = 'QUOTATION_WITHDRAWN';
}
