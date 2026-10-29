import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { HouseholdStatus } from '@vcraft/domain';
import { AppUser } from './app-user.entity.js';
import { BaseEntity } from './base.entity.js';

/**
 * Hộ sản xuất (GLOSSARY). Một tài khoản đại diện cho một hộ; hộ có nhiều nghệ nhân và nhiều xưởng
 * độc lập với tài khoản đại diện. `statusReason` chỉ hiện cho người đại diện và Ban quản lý.
 */
@Entity({ tableName: 'household' })
@Index({ properties: ['status'] })
export class Household extends BaseEntity {
  @Property({ type: 'string', length: 160 })
  name!: string;

  @Property({ type: 'string', length: 160 })
  @Unique()
  slug!: string;

  @Property({ type: 'text' })
  history!: string;

  @Property({ type: 'string', length: 160, nullable: true })
  village?: string | null;

  @Property({ type: 'string', length: 20 })
  status: Opt<HouseholdStatus> = 'PENDING_REVIEW';

  @Property({ type: 'string', length: 500, nullable: true })
  statusReason?: string | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  approvedAt?: Date | null;

  @ManyToOne({ entity: () => AppUser })
  @Unique()
  representative!: AppUser;
}
