import type { MikroORM } from '@mikro-orm/core';
import { AppUser, QuotationNotice } from '@vcraft/database';
import type { NoticeRecipient } from './send-notice-mail';

/** Đọc thông báo và tài khoản nhận từ CSDL; thiếu một trong hai thì trả `null`. */
export function createNoticeLoader(orm: MikroORM) {
  return async (noticeId: string): Promise<NoticeRecipient | null> => {
    const em = orm.em.fork();
    const notice = await em.findOne(QuotationNotice, noticeId);
    if (!notice) return null;
    const user = await em.findOne(AppUser, notice.recipientId);
    if (!user) return null;
    return {
      kind: notice.kind,
      requestId: notice.requestId,
      email: user.email,
      role: user.role,
    };
  };
}
