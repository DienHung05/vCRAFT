import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';

/**
 * A product a signed-in user saved to their favourites (FR-CAT-07). One row per user and product;
 * guests keep the same list in the browser until they sign in.
 */
@Entity({ tableName: 'product_favourite' })
@Unique({ properties: ['userId', 'product'] })
export class ProductFavourite extends BaseEntity {
  @Property({ type: 'uuid' })
  userId!: string;

  @ManyToOne({ entity: () => Product })
  product!: Product;
}
