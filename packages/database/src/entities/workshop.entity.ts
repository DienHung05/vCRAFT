import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import type { OpeningInterval, WorkshopPurpose } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/**
 * Mục đích của xưởng (vCRAFT-9hg.2, 9hg.6): nơi sản xuất có thể khác nơi đón khách.
 * `SHOWROOM` = phòng trưng bày đón khách; `PRODUCTION` = nơi làm; `BOTH` = vừa làm vừa đón khách.
 */
export const WORKSHOP_PURPOSES = [
  'PRODUCTION',
  'SHOWROOM',
  'BOTH',
] as const satisfies readonly WorkshopPurpose[];

/** Xưởng của hộ. Có tọa độ không có nghĩa là đón khách (`acceptsVisitors`). */
@Entity({ tableName: 'workshop' })
@Index({ properties: ['lat', 'lng'] })
export class Workshop extends BaseEntity {
  @ManyToOne({ entity: () => Household, index: true })
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

  /** Giờ mở cửa theo tuần (FR-ART-05); `null` là chưa khai, trang công khai không báo "đang mở". */
  @Property({ type: 'json', nullable: true })
  openingHours?: OpeningInterval[] | null;

  /**
   * Experience offer (FR-ART-05): what a visitor can do here. A workshop offers one exactly when the
   * description is set, and then duration and price are set with it.
   */
  @Property({ type: 'text', nullable: true })
  experienceDescription?: string | null;

  @Property({ type: 'integer', nullable: true })
  experienceDurationMinutes?: number | null;

  @Property({ type: 'integer', nullable: true })
  experiencePriceVnd?: number | null;

  /** Temporarily closed (e.g. a holiday), with the reason shown to visitors; overrides the weekly hours (BR-03). */
  @Property({ type: 'boolean' })
  temporarilyClosed: Opt<boolean> = false;

  @Property({ type: 'string', length: 300, nullable: true })
  closureReason?: string | null;

  @Property({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lat?: string | null;

  @Property({ type: 'decimal', precision: 9, scale: 6, nullable: true })
  lng?: string | null;
}
