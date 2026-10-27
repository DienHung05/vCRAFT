import { type Opt } from '@mikro-orm/core';
import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import { BaseEntity } from './base.entity.js';

/** Trạng thái xử lý của một sự kiện outbox. */
export const OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

/**
 * Transactional Outbox (BR-L8): application service ghi sự kiện miền cùng giao dịch với thay đổi nghiệp vụ;
 * worker đọc bảng này để đẩy Redis pub/sub (SSE), tạo thông báo, gửi mail.
 * `status` lưu dạng chuỗi (không dùng enum gốc của CSDL) để chạy y hệt trên PostgreSQL và MySQL.
 */
@Entity({ tableName: 'outbox_event' })
@Index({ properties: ['status', 'availableAt'] })
export class OutboxEvent extends BaseEntity {
  @Property({ type: 'string', length: 120 })
  type!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Property({ type: 'string', length: 20 })
  status: Opt<OutboxStatus> = 'PENDING';

  @Property({ type: 'integer' })
  attempts: Opt<number> = 0;

  @Property({ type: 'datetime', length: 3 })
  availableAt: Opt<Date> = new Date();
}
