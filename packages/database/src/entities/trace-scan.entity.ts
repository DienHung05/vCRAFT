import { Entity, Index, ManyToOne } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';

/** Một lượt quét mã QR qua đường dẫn ngắn `/q/<code>`, cho số liệu của Ban quản lý (FR-ADM-06). */
@Entity({ tableName: 'trace_scan' })
@Index({ properties: ['createdAt'] })
export class TraceScan extends BaseEntity {
  @ManyToOne({ entity: () => Product, deleteRule: 'cascade' })
  product!: Product;
}
