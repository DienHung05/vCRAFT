import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/**
 * Mục đích của xưởng (vCRAFT-9hg.2, 9hg.6): nơi sản xuất có thể khác nơi đón khách.
 * `SHOWROOM` = phòng trưng bày đón khách; `PRODUCTION` = nơi làm; `BOTH` = vừa làm vừa đón khách.
 */
export const WORKSHOP_PURPOSES = ['PRODUCTION', 'SHOWROOM', 'BOTH'] as const;
export type WorkshopPurpose = (typeof WORKSHOP_PURPOSES)[number];

/** Xưởng của hộ. Có tọa độ không có nghĩa là đón khách (`acceptsVisitors`). */
@Entity({ tableName: 'workshop' })
@Index({ properties: ['lat', 'lng'] })
export class Workshop extends BaseEntity {
  @ManyToOne({ entity: () => Household })
  household!: Household;

  @Property({ type: 'string', length: 160 })
  name!: string;

  @Property({ type: 'string', length: 300 })
  address!: string;

  @Property({ type: 'string', length: 20 })
  purpose: Opt<WorkshopPurpose> = 'PRODUCTION';

  @Property({ type: 'boolean' })
  acceptsVisitors: Opt<boolean> = false;

  /** Thông tin thăm (giờ mở cửa, cần hẹn trước...), văn bản thuần. */
  @Property({ type: 'text', nullable: true })
  visitingInfo?: string | null;

  @Property({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lat?: string | null;

  @Property({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lng?: string | null;
}
