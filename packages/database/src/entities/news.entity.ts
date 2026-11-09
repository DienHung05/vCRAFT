import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type {
  MaterialPriceData,
  NewsCategory,
  NewsOrigin,
  NewsStatus,
  NewsVisibility,
  PowerScheduleData,
} from '@vcraft/domain';
import { normalizeSearchText } from '@vcraft/utils';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/** One of the two structured payloads, keyed by kind so the column stays self-describing. */
export type NewsData = { materialPrices: MaterialPriceData } | { powerSchedule: PowerScheduleData };

/**
 * Tin tức làng nghề (vCRAFT-83g): tin chung của làng hoặc tin của một hộ (`household` có giá trị).
 * `body` là văn bản thuần; `bodyHtml` là HTML đã làm sạch từ trình soạn thảo của Ban quản lý (tin mẫu
 * không có). Tin của hộ bị tạm ngừng không hiện công khai (xem `isHouseholdPublic`). `PUBLISHED` với
 * `publishedAt` trong tương lai là tin hẹn giờ.
 */
const newsSearchText = (n: News) => normalizeSearchText(`${n.title} ${n.summary}`, 800);

@Entity({ tableName: 'news' })
@Index({ properties: ['status', 'pinned', 'publishedAt'] })
@Index({ properties: ['household', 'status'] })
@Index({ properties: ['origin', 'status', 'publishedAt'] })
export class News extends BaseEntity {
  @Property({ type: 'string', length: 200 })
  @Unique()
  slug!: string;

  /** Tiêu đề và tóm tắt đã bỏ dấu cho tìm kiếm (FR-CAT-04); tự tính lại mỗi lần ghi. */
  @Property({
    type: 'string',
    length: 800,
    default: '',
    onCreate: (n: News) => newsSearchText(n),
    onUpdate: (n: News) => newsSearchText(n),
  })
  searchText?: Opt<string>;

  @Property({ type: 'string', length: 200 })
  title!: string;

  @Property({ type: 'string', length: 500 })
  summary!: string;

  @Property({ type: 'text' })
  body!: string;

  /** Sanitized on every write. Never store HTML here from any other path. */
  @Property({ type: 'text', nullable: true })
  bodyHtml?: string | null;

  @Property({ type: 'string', length: 20 })
  visibility: Opt<NewsVisibility> = 'PUBLIC';

  /** Important news notifies households once, when it actually goes live (FR-NEWS-05). */
  @Property({ type: 'boolean' })
  important: Opt<boolean> = false;

  @Property({ type: 'datetime', length: 3, nullable: true })
  notifiedAt?: Date | null;

  @Property({ type: 'string', length: 20 })
  category!: NewsCategory;

  /** Trống = tin chung của làng. */
  @ManyToOne({ entity: () => Household, nullable: true })
  household?: Household | null;

  @Property({ type: 'string', length: 20 })
  status: Opt<NewsStatus> = 'DRAFT';

  @Property({ type: 'datetime', length: 3, nullable: true })
  publishedAt?: Date | null;

  @Property({ type: 'boolean' })
  pinned: Opt<boolean> = false;

  /** Publisher of the original story the item is based on (GH#314). */
  @Property({ type: 'string', length: 120, nullable: true })
  sourceName?: string | null;

  /** Link to the original story; shown to visitors with `sourceName`. */
  @Property({ type: 'string', length: 500, nullable: true })
  sourceUrl?: string | null;

  /** When the original story was published, which can differ from `publishedAt` on this site. */
  @Property({ type: 'datetime', length: 3, nullable: true })
  sourcePublishedAt?: Date | null;

  /** Admin-only provenance (manual, feed import or LLM filler). Never part of a public DTO. */
  @Property({ type: 'string', length: 20 })
  origin: Opt<NewsOrigin> = 'MANUAL';

  /** Structured content of `MATERIAL_PRICES` and `POWER_SCHEDULE` items (PLAN E11). */
  @Property({ type: 'json', nullable: true })
  data?: NewsData | null;
}
