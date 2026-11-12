import type { FilterQuery } from '@mikro-orm/core';
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
// GH#362: the dedupe lookup finds a visitor's recent scan of a product.
@Index({ properties: ['product', 'visitorHash', 'createdAt'] })
export class TraceScan extends BaseEntity {
  @ManyToOne({ entity: () => Product, deleteRule: 'cascade', index: true })
  product!: Product;

  @Property({ type: 'string', length: 2, nullable: true })
  country?: string | null;

  @Property({ type: 'string', length: 10, nullable: true })
  deviceType?: string | null;

  /** sha256(code + ip + user agent + Vietnam day), hex; only used to count a visitor once per window (GH#362). */
  @Property({ type: 'string', length: 64, nullable: true })
  visitorHash?: string | null;
}

/**
 * GH#483: crawlers and link-preview bots are not customers. New automated scans are never stored; rows
 * written before that carry `deviceType = 'bot'`. Every scan total and the public figure count only the
 * rows matching this filter (a missing class is a person: old clients sent none).
 */
export const HUMAN_SCAN_WHERE = {
  $or: [{ deviceType: null }, { deviceType: { $ne: 'bot' } }],
} satisfies FilterQuery<TraceScan>;

/** SQL twin of {@link HUMAN_SCAN_WHERE} for raw queries; `column` is the (aliased) `device_type` column. */
export const humanScanSql = (column = 'device_type'): string =>
  `(${column} is null or ${column} <> 'bot')`;
