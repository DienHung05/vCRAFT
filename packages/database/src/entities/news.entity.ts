import { type Opt } from '@mikro-orm/core';
import { Entity, Index, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { NewsCategory, NewsStatus } from '@vcraft/domain';
import { normalizeSearchText } from '@vcraft/utils';
import { BaseEntity } from './base.entity.js';
import { Household } from './household.entity.js';

/**
 * Tin tức làng nghề (vCRAFT-83g): tin chung của làng hoặc tin của một hộ (`household` có giá trị).
 * `body` là văn bản thuần (không HTML/markdown); giao diện luôn hiển thị như văn bản. Tin của hộ bị
 * tạm ngừng không hiện công khai (xem `isHouseholdPublic`).
 */
const newsSearchText = (n: News) => normalizeSearchText(`${n.title} ${n.summary}`, 800);

@Entity({ tableName: 'news' })
@Index({ properties: ['status', 'pinned', 'publishedAt'] })
@Index({ properties: ['household', 'status'] })
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
}
