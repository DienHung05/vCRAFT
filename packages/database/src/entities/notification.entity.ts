import { Entity, Index, Property } from '@mikro-orm/decorators/legacy';
import type { HouseholdNoticeKind } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

/**
 * Thông báo in-app ngoài luồng báo giá (GH#37): hiện chỉ có quyết định của Ban quản lý về hồ sơ hộ.
 * Luồng báo giá vẫn ghi `quotation_notice`; API `GET /me/notifications` gộp cả hai bảng. Ghi cùng
 * giao dịch với thay đổi nghiệp vụ, kèm một sự kiện outbox `notification.created` cho thư SMTP.
 */
@Entity({ tableName: 'notification' })
@Index({ properties: ['recipientId', 'createdAt'] })
export class Notification extends BaseEntity {
  @Property({ type: 'uuid' })
  recipientId!: string;

  @Property({ type: 'string', length: 40 })
  type!: HouseholdNoticeKind;

  /** Đối tượng liên quan, nếu có (vd. hộ được duyệt). */
  @Property({ type: 'uuid', nullable: true })
  subjectId?: string | null;

  @Property({ type: 'datetime', length: 3, nullable: true })
  readAt?: Date | null;
}
