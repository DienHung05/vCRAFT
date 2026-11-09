import { type Opt } from '@mikro-orm/core';
import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import type { QuotationNoticeKind } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

/**
 * Hộp thư in-app của một người (GH#13). Ghi cùng giao dịch với thay đổi nghiệp vụ gây ra nó; kèm một
 * sự kiện outbox `quotation.notice` để worker gửi thư SMTP.
 */
@Entity({ tableName: 'quotation_notice' })
@Index({ properties: ['recipientId', 'createdAt'] })
export class QuotationNotice extends BaseEntity {
  @Property({ type: 'uuid' })
  recipientId!: string;

  @Property({ type: 'uuid' })
  requestId!: string;

  /** Chào giá liên quan, nếu có (vd. chào giá bị rút, chào giá mới tới). */
  @Property({ type: 'uuid', nullable: true })
  quotationId?: string | null;

  @Property({ type: 'string', length: 40 })
  kind: Opt<QuotationNoticeKind> = 'QUOTATION_WITHDRAWN';

  @Property({ type: 'datetime', length: 3, nullable: true })
  readAt?: Date | null;

  /** Set when the notice mail is claimed for sending (GH#377); cleared again if the send fails. */
  @Property({ type: 'datetime', length: 3, nullable: true })
  emailedAt?: Date | null;
}
