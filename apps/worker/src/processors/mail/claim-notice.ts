import type { MikroORM } from '@mikro-orm/core';
import { Notification, QuotationNotice } from '@vcraft/database';
import { MAIL_CLAIM_LEASE_MS } from './claim-mail';

/**
 * Mail claim over the two notice tables (uuid ids never collide). `claim` is a conditional update that
 * sets `emailed_at` (the claim time) when the notice is unclaimed, or when an earlier claim has no
 * `email_sent_at` and is older than the lease: only one caller wins, so a job re-run after a trimmed job
 * id or a reclaimed outbox event cannot send the same mail twice (GH#377), and a claim left behind by a
 * worker that crashed before sending expires instead of blocking the mail for good (GH#429).
 */
export function createNoticeClaim(
  orm: MikroORM,
  now: () => Date = () => new Date(),
  leaseMs: number = MAIL_CLAIM_LEASE_MS,
) {
  return {
    async claim(noticeId: string): Promise<boolean> {
      const em = orm.em.fork();
      const claimedAt = now();
      const stale = new Date(claimedAt.getTime() - leaseMs);
      const claimable = {
        id: noticeId,
        $or: [{ emailedAt: null }, { emailSentAt: null, emailedAt: { $lt: stale } }],
      };
      const quotation = await em.nativeUpdate(QuotationNotice, claimable, { emailedAt: claimedAt });
      if (quotation > 0) return true;
      const notification = await em.nativeUpdate(Notification, claimable, {
        emailedAt: claimedAt,
      });
      return notification > 0;
    },
    /** Marks the mail as sent so the claim is never taken over. */
    async markSent(noticeId: string): Promise<void> {
      const em = orm.em.fork();
      const sentAt = now();
      await em.nativeUpdate(QuotationNotice, { id: noticeId }, { emailSentAt: sentAt });
      await em.nativeUpdate(Notification, { id: noticeId }, { emailSentAt: sentAt });
    },
    /** Undo a claim after a failed send so the retry can send. */
    async release(noticeId: string): Promise<void> {
      const em = orm.em.fork();
      await em.nativeUpdate(QuotationNotice, { id: noticeId }, { emailedAt: null });
      await em.nativeUpdate(Notification, { id: noticeId }, { emailedAt: null });
    },
  };
}
