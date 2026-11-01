import type { MikroORM } from '@mikro-orm/core';
import { AppUser, Notification, NotificationPreference, QuotationNotice } from '@vcraft/database';
import type { NotificationType } from '@vcraft/domain';
import type { NoticeRecipient } from './send-notice-mail';

/**
 * Đọc thông báo (luồng báo giá hoặc `notification`, id là uuid nên không trùng giữa hai bảng), tài
 * khoản nhận và tùy chọn email của họ từ CSDL; thiếu thông báo hoặc người nhận thì trả `null`.
 * Không có dòng tùy chọn nghĩa là mặc định: gửi thư.
 */
export function createNoticeLoader(orm: MikroORM) {
  return async (noticeId: string): Promise<NoticeRecipient | null> => {
    const em = orm.em.fork();
    let recipientId: string;
    let kind: NotificationType;
    let subjectId: string | null;
    const quotation = await em.findOne(QuotationNotice, noticeId);
    if (quotation) {
      recipientId = quotation.recipientId;
      kind = quotation.kind;
      subjectId = quotation.requestId;
    } else {
      const notification = await em.findOne(Notification, noticeId);
      if (!notification) return null;
      recipientId = notification.recipientId;
      kind = notification.type;
      subjectId = notification.subjectId ?? null;
    }
    const user = await em.findOne(AppUser, recipientId);
    // A deleted account has no email address any more (NFR-SEC-07).
    if (!user || user.status === 'DELETED') return null;
    const preference = await em.findOne(NotificationPreference, {
      userId: recipientId,
      type: kind,
    });
    return {
      kind,
      subjectId,
      email: user.email,
      role: user.role,
      emailEnabled: preference?.emailEnabled ?? true,
    };
  };
}
