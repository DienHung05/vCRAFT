import type { MikroORM } from '@mikro-orm/core';
import { Notification, QuotationNotice } from '@vcraft/database';

/**
 * Mail claim over the two notice tables (uuid ids never collide). `claim` is a conditional update
 * `SET emailed_at = now WHERE id = ? AND emailed_at IS NULL`: only one caller wins, so a job re-run
 * after a trimmed job id or a reclaimed outbox event cannot send the same mail twice (GH#377).
 */
export function createNoticeClaim(orm: MikroORM) {
  return {
    async claim(noticeId: string): Promise<boolean> {
      const em = orm.em.fork();
      const claimedAt = new Date();
      const quotation = await em.nativeUpdate(
        QuotationNotice,
        { id: noticeId, emailedAt: null },
        { emailedAt: claimedAt },
      );
      if (quotation > 0) return true;
      const notification = await em.nativeUpdate(
        Notification,
        { id: noticeId, emailedAt: null },
        { emailedAt: claimedAt },
      );
      return notification > 0;
    },
    /** Undo a claim after a failed send so the retry can send. */
    async release(noticeId: string): Promise<void> {
      const em = orm.em.fork();
      await em.nativeUpdate(QuotationNotice, { id: noticeId }, { emailedAt: null });
      await em.nativeUpdate(Notification, { id: noticeId }, { emailedAt: null });
    },
  };
}
