import { Entity, ManyToOne, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { JournalStage } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';
import { Product } from './product.entity.js';

/** Ảnh minh chứng của một mốc: đường dẫn hiển thị và SHA-256 nội dung (đi vào chuỗi băm). */
export interface JournalImage {
  url: string;
  sha256: string;
}

/**
 * Mốc nhật ký sản xuất (vCRAFT-9hg.4). `declaredDate` là ngày hộ khai (câu chuyện), `createdAt` là lúc
 * hệ thống lưu (thứ tự và lịch sử đính chính). Sau lần xuất bản đầu tiên chỉ được ghi thêm; sửa sai
 * bằng mốc mới có `supersedes`. `prevHash`/`hash` nối các mốc thành chuỗi SHA-256 theo `seq`.
 */
@Entity({ tableName: 'journal_entry' })
@Unique({ properties: ['product', 'seq'] })
export class JournalEntry extends BaseEntity {
  @ManyToOne({ entity: () => Product })
  product!: Product;

  @Property({ type: 'integer' })
  seq!: number;

  @Property({ type: 'string', length: 20 })
  stage!: JournalStage;

  /** `YYYY-MM-DD`, lưu dạng chuỗi để băm đúng giá trị đã khai trên mọi CSDL. */
  @Property({ type: 'string', length: 10 })
  declaredDate!: string;

  @Property({ type: 'text' })
  note!: string;

  @Property({ type: 'json' })
  images!: JournalImage[];

  @ManyToOne({ entity: () => JournalEntry, nullable: true })
  supersedes?: JournalEntry | null;

  @Property({ type: 'string', length: 300, nullable: true })
  skipReason?: string | null;

  @Property({ type: 'string', length: 64 })
  prevHash!: string;

  @Property({ type: 'string', length: 64 })
  hash!: string;
}
