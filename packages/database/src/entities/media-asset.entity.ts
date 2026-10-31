import { type Opt } from '@mikro-orm/core';
import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import type { MediaPurpose, MediaVisibility } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

export const MEDIA_STATUSES = ['PROCESSING', 'READY', 'FAILED'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

/** Một biến thể đã tối ưu trong bucket công khai; key chứa hash nội dung nên cache vĩnh viễn được. */
export interface MediaVariant {
  format: 'avif' | 'webp';
  width: number;
  height: number;
  key: string;
  bytes: number;
}

/** Ghi nguồn ảnh có giấy phép (CC BY / BY-SA bắt buộc ghi tác giả và giấy phép). */
export interface MediaCredit {
  /** Tên trang tệp ở nguồn (vd. `File:...` trên Wikimedia Commons). */
  title: string;
  author: string;
  license: string;
  licenseUrl: string;
  /** Trang mô tả tệp (nguồn và lịch sử). */
  sourceUrl: string;
}

/**
 * Tệp do người dùng tải lên (FR-MEDIA, ADR-14). Bản gốc luôn nằm trong bucket riêng tư (`originalKey`);
 * ảnh công khai được worker xóa EXIF và sinh `variants` ở bucket công khai. Tệp riêng tư chỉ đọc
 * qua presigned URL 5 phút, không bao giờ có URL công khai.
 */
@Entity({ tableName: 'media_asset' })
@Index({ properties: ['ownerId', 'sha256'] })
export class MediaAsset extends BaseEntity {
  /** `AppUser.id` của người tải lên. */
  @Property({ type: 'uuid' })
  ownerId!: string;

  @Property({ type: 'string', length: 20 })
  purpose!: MediaPurpose;

  @Property({ type: 'string', length: 10 })
  visibility!: MediaVisibility;

  @Property({ type: 'string', length: 20 })
  status: Opt<MediaStatus> = 'PROCESSING';

  /** Loại thật dò từ magic bytes, không phải `Content-Type` client khai. */
  @Property({ type: 'string', length: 60 })
  mimeType!: string;

  @Property({ type: 'integer' })
  sizeBytes!: number;

  @Property({ type: 'string', length: 64 })
  sha256!: string;

  @Property({ type: 'string', length: 300 })
  originalKey!: string;

  @Property({ type: 'integer', nullable: true })
  width?: number | null;

  @Property({ type: 'integer', nullable: true })
  height?: number | null;

  /** ThumbHash (base64) để vẽ nền mờ trước khi ảnh tải xong. */
  @Property({ type: 'string', length: 64, nullable: true })
  thumbhash?: string | null;

  /** `#rrggbb`. */
  @Property({ type: 'string', length: 7, nullable: true })
  dominantColor?: string | null;

  @Property({ type: 'json' })
  variants: Opt<MediaVariant[]> = [];

  @Property({ type: 'string', length: 300, nullable: true })
  failureReason?: string | null;

  /** Mô tả mặc định cho người dùng trình đọc màn hình; mỗi chỗ dùng có thể ghi đè ở `MediaLink.altText`. */
  @Property({ type: 'string', length: 500, nullable: true })
  altText?: string | null;

  /** Tác giả và giấy phép của ảnh; để trống với ảnh do chính hộ chụp. */
  @Property({ type: 'json', nullable: true })
  credit?: MediaCredit | null;
}
