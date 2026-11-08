import { Entity, Index, ManyToOne, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';

/**
 * Một lượt quét mã QR qua đường dẫn ngắn `/q/<code>`, cho số liệu của Ban quản lý (FR-ADM-06).
 * FR-TRC-06: also the scanner's country (ISO 3166-1 alpha-2) and device class, both optional; no IP address.
 */
@Entity({ tableName: 'trace_scan' })
@Index({ properties: ['createdAt'] })
// The `popular` catalog sort counts a product's scans in a time window (FR-CAT-02).
@Index({ properties: ['product', 'createdAt'] })
export class TraceScan extends BaseEntity {
  @ManyToOne({ entity: () => Product, deleteRule: 'cascade', index: true })
  product!: Product;

  @Property({ type: 'string', length: 2, nullable: true })
  country?: string | null;

  @Property({ type: 'string', length: 10, nullable: true })
  deviceType?: string | null;
}
