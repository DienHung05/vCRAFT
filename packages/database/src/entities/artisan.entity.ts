import { Entity, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/** Nghệ nhân: người làm, được ghi công riêng; không cần tài khoản (vCRAFT-9hg.2). */
@Entity({ tableName: 'artisan' })
export class Artisan extends BaseEntity {
  @ManyToOne({ entity: () => Household, index: true })
  household!: Household;

  @Property({ type: 'string', length: 160 })
  name!: string;

  @Property({ type: 'string', length: 160, nullable: true })
  craftRole?: string | null;

  @Property({ type: 'text', nullable: true })
  bio?: string | null;
}
