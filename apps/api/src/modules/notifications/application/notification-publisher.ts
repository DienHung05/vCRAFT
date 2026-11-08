import type { EntityManager } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { Notification, OutboxEvent } from '@vcraft/database';
import { type HouseholdNoticeKind, noticeRecipients, type PaymentNoticeKind } from '@vcraft/domain';

/** Sự kiện outbox mà worker đổi thành một thư SMTP cho mỗi thông báo (bảng `notification`). */
export const NOTIFICATION_CREATED_EVENT = 'notification.created';

export interface NotificationInput {
  type: HouseholdNoticeKind | PaymentNoticeKind;
  /** Đối tượng liên quan (vd. mã hộ). */
  subjectId?: string | null;
  /** Người gây ra sự kiện; không tự nhận thông báo của chính mình. */
  actorId: string;
  recipientIds: ReadonlyArray<string | null | undefined>;
  /** Xếp thư SMTP qua outbox (mặc định có). Tắt khi sự kiện nghiệp vụ đã có thư riêng, tránh gửi hai lần. */
  email?: boolean;
}

/**
 * Ghi thông báo in-app ngoài luồng báo giá và sự kiện outbox cho thư SMTP (GH#37). Chạy trong
 * giao dịch của người gọi nên thông báo chỉ tồn tại khi thay đổi nghiệp vụ được commit.
 */
@Injectable()
export class NotificationPublisher {
  publish(em: EntityManager, input: NotificationInput): string[] {
    const recipients = noticeRecipients(input.recipientIds, input.actorId);
    if (recipients.length === 0) return [];
    const notifications = recipients.map((recipientId) =>
      em.create(Notification, {
        recipientId,
        type: input.type,
        subjectId: input.subjectId ?? null,
      }),
    );
    const noticeIds = notifications.map((notification) => notification.id);
    if (input.email !== false) {
      em.create(OutboxEvent, { type: NOTIFICATION_CREATED_EVENT, payload: { noticeIds } });
    }
    return noticeIds;
  }
}
