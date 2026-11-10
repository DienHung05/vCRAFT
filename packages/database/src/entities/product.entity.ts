import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { ProductCategory, ProductStatus } from '@vcraft/domain';
import { normalizeSearchText } from '@vcraft/utils';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/** `OBJECT` = một vật đơn chiếc; `BATCH` = một lô sản xuất cùng mẫu (GLOSSARY). */
export const PRODUCT_KINDS = ['OBJECT', 'BATCH'] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Ảnh sản phẩm theo thứ tự hiển thị; ảnh đầu là ảnh bìa (FR-PRD-02). */
export interface ProductImage {
  mediaId: string;
  alt: string;
}

// Tags come before the description so the 700-character cap never cuts them off.
const productSearchText = (p: Product) =>
  normalizeSearchText(
    `${p.name} ${p.nameEn ?? ''} ${(p.tags ?? []).join(' ')} ${p.traceCode} ${p.description}`,
    700,
  );

/**
 * Sản phẩm: một vật hoặc một lô do đúng một hộ chịu trách nhiệm, có nhật ký và mã QR riêng.
 * `traceCode` in trên QR (`/q/<code>`), không đổi khi đổi tên/slug.
 */
@Entity({ tableName: 'product' })
@Index({ properties: ['household', 'status'] })
@Index({ properties: ['status', 'category'] })
@Index({ properties: ['status', 'priceVnd'] })
@Index({ properties: ['status', 'publishedAt'] })
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

  /** Optional English name; empty means pages on `/en` show `name`. Part of `searchText`. */
  @Property({ type: 'string', length: 200, nullable: true })
  nameEn?: string | null;

  /** Optional English description; empty means pages on `/en` show `description`. */
  @Property({ type: 'text', nullable: true })
  descriptionEn?: string | null;

  @Property({ type: 'string', length: 10 })
  kind: Opt<ProductKind> = 'OBJECT';

  /** Số vật trong lô (chỉ với `BATCH`), khác số còn bán. */
  @Property({ type: 'integer', nullable: true })
  batchSize?: number | null;

  @Property({ type: 'string', length: 20, default: 'DECOR' })
  category: Opt<ProductCategory> = 'DECOR';

  /** Giá bán (VND); `0` là chưa niêm yết, giao diện mời liên hệ báo giá. */
  @Property({ type: 'integer', default: 0 })
  priceVnd: Opt<number> = 0;

  /** Số còn bán (FR-PRD-01). */
  @Property({ type: 'integer', default: 0 })
  stock: Opt<number> = 0;

  @Property({ type: 'string', length: 200, nullable: true })
  material?: string | null;

  @Property({ type: 'string', length: 200, nullable: true })
  dimensions?: string | null;

  /** Optional English material; empty means pages on `/en` show `material`. */
  @Property({ type: 'string', length: 200, nullable: true })
  materialEn?: string | null;

  /** Optional English dimensions; empty means pages on `/en` show `dimensions`. */
  @Property({ type: 'string', length: 200, nullable: true })
  dimensionsEn?: string | null;

  @Property({ type: 'integer', nullable: true })
  weightGrams?: number | null;

  /** Lời của người làm, hiện trên trang sản phẩm và trang QR. */
  @Property({ type: 'text', nullable: true })
  artisanNote?: string | null;

  /** Ảnh bìa (đường dẫn tương đối hoặc URL công khai) và mô tả đúng điều nhìn thấy trong ảnh. */
  @Property({ type: 'string', length: 500, nullable: true })
  coverUrl?: string | null;

  @Property({ type: 'string', length: 500, nullable: true })
  coverAlt?: string | null;

  /** English description of the preset cover; empty means pages on `/en` fall back to `coverAlt`. */
  @Property({ type: 'string', length: 500, nullable: true })
  coverAltEn?: string | null;

  @Property({ type: 'json', nullable: true })
  images?: ProductImage[] | null;

  /** Free-text tags (FR-PRD-01): at most 10, 1 to 30 characters each, diacritics kept for display. */
  @Property({ type: 'json', nullable: true })
  tags?: string[] | null;

  /** Tên, mô tả, mã đã bỏ dấu cho tìm kiếm (FR-CAT-04); tự tính lại mỗi lần ghi. */
  @Property({
    type: 'string',
    length: 700,
    default: '',
    onCreate: (p: Product) => productSearchText(p),
    onUpdate: (p: Product) => productSearchText(p),
  })
  searchText?: Opt<string>;

  @Property({ type: 'string', length: 20 })
  status: Opt<ProductStatus> = 'DRAFT';

  @Property({ type: 'datetime', length: 3, nullable: true })
  publishedAt?: Date | null;

  @Property({ type: 'string', length: 500, nullable: true })
  withdrawnReason?: string | null;

  /** Who withdrew the product; a board withdrawal can only be undone by the board (GH#428). */
  @Property({ type: 'string', length: 10, nullable: true })
  withdrawnBy?: 'OWNER' | 'BOARD' | null;
}
