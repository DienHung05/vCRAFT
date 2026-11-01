import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';
import { MediaAsset } from './media-asset.entity.js';

/** Đối tượng được gắn tệp. Ảnh của mốc nhật ký nằm trong `JournalEntry.images` (đi vào chuỗi băm), không ở đây. */
export const MEDIA_LINK_TARGETS = ['PRODUCT', 'HOUSEHOLD', 'NEWS'] as const;
export type MediaLinkTarget = (typeof MEDIA_LINK_TARGETS)[number];

/**
 * `COVER`: ảnh đại diện (sản phẩm, tin); `PORTRAIT`/`BANNER`: ảnh thẻ và ảnh bìa của hộ; `GALLERY`: ảnh
 * trong thư viện; `DOCUMENT`: giấy tờ xác minh của hộ (tệp riêng tư, chỉ Ban quản lý xem).
 */
export const MEDIA_LINK_ROLES = ['COVER', 'PORTRAIT', 'BANNER', 'GALLERY', 'DOCUMENT'] as const;
export type MediaLinkRole = (typeof MEDIA_LINK_ROLES)[number];

/**
 * Gắn một {@link MediaAsset} vào một sản phẩm, hộ hoặc tin. `targetId` không có khóa ngoại (đa hình theo
 * `targetType`); mọi đường xóa dữ liệu nghiệp vụ phải xóa `media_link` trước `media_asset`. Một chỗ (đối tượng,
 * vai trò, thứ tự) chỉ có một tệp.
 */
@Entity({ tableName: 'media_link' })
@Unique({ properties: ['targetType', 'targetId', 'role', 'position'] })
@Index({ properties: ['targetType', 'targetId'] })
export class MediaLink extends BaseEntity {
  @ManyToOne({ entity: () => MediaAsset })
  media!: MediaAsset;

  @Property({ type: 'string', length: 20 })
  targetType!: MediaLinkTarget;

  @Property({ type: 'uuid' })
  targetId!: string;

  @Property({ type: 'string', length: 20 })
  role!: MediaLinkRole;

  /** Thứ tự trong cùng vai trò (thư viện ảnh). */
  @Property({ type: 'integer' })
  position: Opt<number> = 0;

  /** Mô tả riêng cho chỗ dùng này; trống thì dùng `MediaAsset.altText`. */
  @Property({ type: 'string', length: 500, nullable: true })
  altText?: string | null;

  /**
   * English description of this use. Empty for uploads that only have a Vietnamese description: pages
   * on `/en` then fall back to `altText`.
   */
  @Property({ type: 'string', length: 500, nullable: true })
  altEn?: string | null;

  /** Chú thích hiển thị dưới ảnh. */
  @Property({ type: 'string', length: 300, nullable: true })
  caption?: string | null;
}
