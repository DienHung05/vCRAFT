import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import { Artisan } from './artisan.entity.js';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';

/**
 * Ghi công một nghệ nhân cho một sản phẩm, kèm phần việc (vuốt dáng, vẽ lam...). Người đăng là ban
 * điều hành hộ và không được ghi ở đây (vCRAFT-9hg.6).
 */
@Entity({ tableName: 'product_maker' })
@Unique({ properties: ['product', 'artisan'] })
export class ProductMaker extends BaseEntity {
  @ManyToOne({ entity: () => Product })
  product!: Product;

  @ManyToOne({ entity: () => Artisan })
  artisan!: Artisan;

  @Property({ type: 'string', length: 160 })
  contribution!: string;

  /** Thứ tự hiển thị. */
  @Property({ type: 'integer' })
  position!: number;
}
