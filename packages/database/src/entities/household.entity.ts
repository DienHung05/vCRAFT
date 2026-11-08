import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { CraftCategory, HouseholdStatus, ProductCategory } from '@vcraft/domain';
import { normalizeSearchText } from '@vcraft/utils';
import { AppUser } from './app-user.entity.js';
import { BaseEntity } from './base.entity.js';

export interface HouseholdTimelineEvent {
  year: number;
  title: string;
  text: string;
  /** Photo the household uploaded itself (`media_asset` id). */
  photo?: { mediaId: string; alt: string } | null;
}

/** Chứng nhận do hộ khai; chỉ Ban quản lý mới đánh dấu `verified` (FR-ART-03). */
export interface HouseholdCertification {
  name: string;
  issuer: string;
  /** Always set: derived from `issuedOn` when the household gave a date, the legacy year otherwise. */
  year: number;
  /** Issue date, `YYYY-MM-DD`. */
  issuedOn?: string | null;
  /** Optional photo of the certificate (a public image asset). */
  photo?: HouseholdPhoto | null;
  verified: boolean;
}

/** A photo of the household's own (cover, portrait, seal, certificate): a media asset and its description. */
export interface HouseholdPhoto {
  mediaId: string;
  alt: string;
}

/** Ảnh xưởng: tải lên (`mediaId`) hoặc ảnh có sẵn của dữ liệu mẫu (`url`); `alt` luôn bắt buộc. */
export interface HouseholdGalleryItem {
  mediaId?: string;
  url?: string;
  alt: string;
  caption?: string;
}

const householdSearchText = (h: Household) =>
  normalizeSearchText(`${h.name} ${h.village ?? ''} ${h.craft ?? ''}`);

/**
 * Hộ sản xuất (GLOSSARY). Một tài khoản đại diện cho một hộ; hộ có nhiều nghệ nhân và nhiều xưởng
 * độc lập với tài khoản đại diện. `statusReason` chỉ hiện cho người đại diện và Ban quản lý.
 */
@Entity({ tableName: 'household' })
@Index({ properties: ['status'] })
export class Household extends BaseEntity {
  @Property({ type: 'string', length: 160 })
  name!: string;

  @Property({ type: 'string', length: 160 })
  @Unique()
  slug!: string;

  @Property({ type: 'text' })
  history!: string;

  @Property({ type: 'string', length: 160, nullable: true })
  village?: string | null;

  /** Nghề của hộ (lọc trên bản đồ, FR-MAP-03), văn bản ngắn do hộ khai. */
  @Property({ type: 'string', length: 160, nullable: true })
  craft?: string | null;

  /** Craft category from a fixed list (FR-ART-01); null for households that only have legacy `craft` text. */
  @Property({ type: 'string', length: 20, nullable: true })
  craftCategory?: CraftCategory | null;

  /** Own cover photo (FR-ART-01); outranks `coverUrl` and the linked banner. */
  @Property({ type: 'json', nullable: true })
  coverPhoto?: HouseholdPhoto | null;

  /** Own portrait of the artisan, shown next to the story. */
  @Property({ type: 'json', nullable: true })
  portraitPhoto?: HouseholdPhoto | null;

  /** Personal seal or signature, shown near the end of the story. */
  @Property({ type: 'json', nullable: true })
  sealPhoto?: HouseholdPhoto | null;

  /** Ảnh bìa (đường dẫn tương đối hoặc URL công khai); không có thì giao diện dùng hình thay thế. */
  @Property({ type: 'string', length: 500, nullable: true })
  coverUrl?: string | null;

  @Property({ type: 'integer', nullable: true })
  foundedYear?: number | null;

  /** Số đời làm nghề. */
  @Property({ type: 'integer', nullable: true })
  generations?: number | null;

  /** Dòng thời gian lịch sử gia đình (FR-ART-02). */
  @Property({ type: 'json', nullable: true })
  timeline?: HouseholdTimelineEvent[] | null;

  @Property({ type: 'json', nullable: true })
  certifications?: HouseholdCertification[] | null;

  /** Thư viện ảnh xưởng, theo thứ tự hiển thị (FR-ART-04). */
  @Property({ type: 'json', nullable: true })
  gallery?: HouseholdGalleryItem[] | null;

  /** Năng lực sản xuất (đơn vị/tháng) theo danh mục (FR-ART-06). */
  @Property({ type: 'json', nullable: true })
  capacityByCategory?: Partial<Record<ProductCategory, number>> | null;

  /** Tên, làng, nghề đã bỏ dấu cho tìm kiếm (FR-CAT-04); tự tính lại mỗi lần ghi. */
  @Property({
    type: 'string',
    length: 600,
    default: '',
    onCreate: (h: Household) => householdSearchText(h),
    onUpdate: (h: Household) => householdSearchText(h),
  })
  searchText?: Opt<string>;

  @Property({ type: 'string', length: 20 })
  status: Opt<HouseholdStatus> = 'PENDING_REVIEW';

  @Property({ type: 'string', length: 500, nullable: true })
  statusReason?: string | null;

  /** Explicit marker: the representative resubmitted the application at this time (vCRAFT-8my.2). */
  @Property({ type: 'datetime', length: 3, nullable: true })
  resubmittedAt?: Date | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  approvedAt?: Date | null;

  @ManyToOne({ entity: () => AppUser })
  @Unique()
  representative!: AppUser;

  /**
   * Citizen ID number of the representative, sealed with AES-256-GCM (`FieldCipher`, NFR-SEC-03). Never the
   * plaintext: services encrypt on write and decrypt only for the owner, an admin reveal and the owner's export.
   */
  @Property({ type: 'string', length: 255, nullable: true })
  idNumberEnc?: string | null;
}
