import { type MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import { MailClaim } from '@vcraft/database';

/**
 * How long a claim without a sent marker is trusted. A mail send takes seconds; a claim older than this
 * belongs to a worker that died mid-send, so another run may take it over (GH#429).
 */
export const MAIL_CLAIM_LEASE_MS = 10 * 60_000;

/**
 * Durable claim over a mail key (the BullMQ job id, derived from the outbox event id). `claim` inserts the
 * `mail_claim` row, so only one caller wins and a job re-run after `trimFinishedJobs` or a reclaimed outbox
 * event cannot send twice. An unsent claim past the lease is taken over; a sent one never is.
 */
export function createMailClaim(
  orm: MikroORM,
  now: () => Date = () => new Date(),
  leaseMs: number = MAIL_CLAIM_LEASE_MS,
) {
  return {
    async claim(key: string): Promise<boolean> {
      const claimedAt = now();
      const stale = new Date(claimedAt.getTime() - leaseMs);
      const taken = await orm.em
        .fork()
        .nativeUpdate(
          MailClaim,
          { claimKey: key, sentAt: null, claimedAt: { $lt: stale } },
          { claimedAt },
        );
      if (taken > 0) return true;
      try {
        const em = orm.em.fork();
        em.create(MailClaim, { claimKey: key, claimedAt });
        await em.flush();
        return true;
      } catch (error) {
        if (error instanceof UniqueConstraintViolationException) return false;
        throw error;
      }
    },
    /** Stamps the claim as sent; it is never taken over after this. */
    async markSent(key: string): Promise<void> {
      await orm.em.fork().nativeUpdate(MailClaim, { claimKey: key }, { sentAt: now() });
    },
    /** Drops an unsent claim after a failed send so the retry can claim again. */
    async release(key: string): Promise<void> {
      await orm.em.fork().nativeDelete(MailClaim, { claimKey: key, sentAt: null });
    },
  };
}
