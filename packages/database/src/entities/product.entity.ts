import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { ProductStatus } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/** `OBJECT` = một vật đơn chiếc; `BATCH` = một lô sản xuất cùng mẫu (GLOSSARY). */
export const PRODUCT_KINDS = ['OBJECT', 'BATCH'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/**
 * Sản phẩm: một vật hoặc một lô do đúng một hộ chịu trách nhiệm, có nhật ký và mã QR riêng.
 * `traceCode` in trên QR (`/q/<code>`), không đổi khi đổi tên/slug.
 */
@Entity({ tableName: 'product' })
@Index({ properties: ['household', 'status'] })
export class Product extends BaseEntity {
  @ManyToOne({ entity: () => Household })
  household!: Household;

  @Property({ type: 'string', length: 200 })
  name!: string;

  @Property({ type: 'string', length: 200 })
  @Unique()
  slug!: string;

  @Property({ type: 'string', length: 16 })
  @Unique()
  traceCode!: string;

  @Property({ type: 'text' })
  description!: string;

  @Property({ type: 'string', length: 10 })
  kind: Opt<ProductKind> = 'OBJECT';

  /** Số vật trong lô (chỉ với `BATCH`), khác số còn bán. */
  @Property({ type: 'integer', nullable: true })
  batchSize?: number | null;

  @Property({ type: 'string', length: 20 })
  status: Opt<ProductStatus> = 'DRAFT';

  @Property({ type: 'datetime', length: 3, nullable: true })
  publishedAt?: Date | null;

  @Property({ type: 'string', length: 500, nullable: true })
  withdrawnReason?: string | null;
}
