import { type Opt } from '@mikro-orm/core';
import { Entity, Property, Unique } from '@mikro-orm/decorators/legacy';
import type { NotificationType } from '@vcraft/domain';
import { BaseEntity } from './base.entity.js';

/**
 * Tùy chọn nhận email của một người cho một loại thông báo (GH#37, FR-NOTI-02). Không có dòng nào
 * nghĩa là mặc định: gửi thư. Chỉ thư SMTP bị ảnh hưởng; thông báo in-app luôn được ghi.
 */
@Entity({ tableName: 'notification_preference' })
@Unique({ properties: ['userId', 'type'] })
export class NotificationPreference extends BaseEntity {
  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: 'string', length: 40 })
  type!: NotificationType;

  @Property({ type: 'boolean' })
  emailEnabled: Opt<boolean> = true;
}
