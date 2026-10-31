import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import type { AllocationStatus } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { CooperativeQuotation } from './cooperative-quotation.entity.js';
import { Household } from './household.entity.js';

export interface AllocationProgressEntry {
  at: string;
  completedQty: number;
  note: string | null;
  photoUrl: string | null;
}

/**
 * GH#11: một phân bổ trong đơn đã chốt. Sinh ra ở `PROPOSED` khi buyer chốt
 * chào giá; hộ CONFIRM/DECLINE; DECLINE hủy cả đơn chưa sản xuất.
 */
@Entity({ tableName: 'order_allocation' })
@Index({ properties: ['quotation', 'status'] })
export class OrderAllocation extends BaseEntity {
  @ManyToOne({ entity: () => CooperativeQuotation })
  quotation!: CooperativeQuotation;

  @ManyToOne({ entity: () => Household })
  household!: Household;

  @Property({ type: 'integer' })
  quantity!: number;

  @Property({ type: 'integer' })
  completedQty: Opt<number> = 0;

  @Property({ type: 'string', length: 20 })
  status: Opt<AllocationStatus> = 'PROPOSED';

  /** Each progress report as it was made (FR-ORD-07): quantity done, note and photo. */
  @Property({ type: 'json', nullable: true })
  progressLog?: AllocationProgressEntry[] | null;
}
