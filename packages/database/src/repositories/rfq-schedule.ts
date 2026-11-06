import { type EntityManager, LockMode, type MikroORM } from '@mikro-orm/core';
import {
  noticeRecipients,
  type QuotationNoticeKind,
  RFQ_ACCEPT_GRACE_MS,
  transition,
} from '@vcraft/domain';
import { AppUser } from '../entities/app-user.entity.js';
import { ContributionOffer } from '../entities/contribution-offer.entity.js';
import { Household } from '../entities/household.entity.js';
import { OutboxEvent } from '../entities/outbox-event.entity.js';
import { QuotationNotice } from '../entities/quotation-notice.entity.js';
import { QuotationRequest } from '../entities/quotation-request.entity.js';

/** The system is the actor of scheduled changes; nobody is excluded from the notices as "the actor". */
const SYSTEM_ACTOR = 'system';

/** Opt-in requests still unclaimed this close to the deadline get flagged (PLAN E9). */
export const UNCLAIMED_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Requests closing within this window whose active offers cannot cover the quantity get flagged. */
export const SHORTFALL_WINDOW_MS = 24 * 60 * 60 * 1000;

async function notify(
  em: EntityManager,
  kind: QuotationNoticeKind,
  requestId: string,
  candidates: ReadonlyArray<string | null | undefined>,
) {
  const recipients = noticeRecipients(candidates, SYSTEM_ACTOR);
  if (recipients.length === 0) return;
  const notices = recipients.map((recipientId) =>
    em.create(QuotationNotice, { recipientId, requestId, quotationId: null, kind }),
  );
  // Same event the API writes, so the worker mails each notice like any other (GH#13).
  em.create(OutboxEvent, {
    type: 'quotation.notice',
    payload: { noticeIds: notices.map((notice) => notice.id) },
  });
}

async function invitedRepresentatives(em: EntityManager, request: QuotationRequest) {
  if (request.invitedHouseholdIds.length === 0) return [];
  const households = await em.find(
    Household,
    { id: { $in: [...new Set(request.invitedHouseholdIds)] } },
    { populate: ['representative'] },
  );
  return households.map((household) => household.representative.id);
}

export type ExpireOutcome = 'EXPIRED' | 'BIDDING_CLOSED' | 'UNCHANGED';

/**
 * `rfq.expire` for one request (FR-RFQ, BR-05, T8). At the bidding deadline a request without offers
 * (`SENT`) expires; one with offers (`BIDDING`) stays open for the buyer's accept window and everybody is
 * told bidding has closed; once that window has passed it expires too. Idempotent: a row lock plus
 * `biddingClosedAt` mean a retried or duplicated job changes and notifies nothing twice.
 */
export async function expireRequest(
  orm: MikroORM,
  requestId: string,
  now = new Date(),
): Promise<ExpireOutcome> {
  return orm.em.fork().transactional(async (em) => {
    const request = await em.findOne(QuotationRequest, requestId, {
      lockMode: LockMode.PESSIMISTIC_WRITE,
    });
    if (!request || (request.status !== 'SENT' && request.status !== 'BIDDING')) return 'UNCHANGED';
    if (now.getTime() < request.biddingClosesAt.getTime()) return 'UNCHANGED';

    const expired = transition(request.status, 'EXPIRE', {
      actor: 'SYSTEM',
      now,
      biddingClosesAt: request.biddingClosesAt,
    });
    const recipients = [request.buyer.id, ...(await invitedRepresentatives(em, request))];
    if (expired.ok) {
      request.status = expired.value;
      request.biddingClosedAt ??= now;
      await notify(em, 'RFQ_EXPIRED', request.id, recipients);
      return 'EXPIRED';
    }
    if (request.biddingClosedAt) return 'UNCHANGED';
    request.biddingClosedAt = now;
    await notify(em, 'BIDDING_CLOSED', request.id, recipients);
    return 'BIDDING_CLOSED';
  });
}

/**
 * Requests whose deadline handling is due: past the bidding deadline and not handled yet, or still in
 * `BIDDING` after the accept window. The sweep catches anything a delayed job missed (a request sent
 * before the scheduler existed, a lost Redis job).
 */
export async function dueRequestIds(
  orm: MikroORM,
  now = new Date(),
  limit = 50,
): Promise<string[]> {
  const rows = await orm.em.fork().find(
    QuotationRequest,
    {
      $or: [
        {
          status: { $in: ['SENT', 'BIDDING'] },
          biddingClosesAt: { $lte: now },
          biddingClosedAt: null,
        },
        {
          status: 'BIDDING',
          biddingClosesAt: { $lte: new Date(now.getTime() - RFQ_ACCEPT_GRACE_MS) },
        },
      ],
    },
    { fields: ['id'], orderBy: { biddingClosesAt: 'asc' }, limit },
  );
  return rows.map((row) => row.id);
}

/**
 * `rfq.coordination-check` (PLAN E9): flags open requests that need the village board, once each, and
 * tells the coordinator (or every active admin when nobody has claimed the request):
 * - an opt-in request nobody has claimed, two days or less before bidding closes;
 * - a request closing within a day whose active offers together cannot cover the quantity.
 * Returns the ids flagged by this run.
 */
export async function flagRequestsNeedingCoordination(
  orm: MikroORM,
  now = new Date(),
): Promise<string[]> {
  const open = await orm.em.fork().find(
    QuotationRequest,
    {
      status: { $in: ['SENT', 'BIDDING'] },
      biddingClosesAt: { $gt: now },
      coordinationFlaggedAt: null,
    },
    { fields: ['id'], limit: 200 },
  );
  const flagged: string[] = [];
  for (const { id } of open) {
    const done = await orm.em.fork().transactional(async (em) => {
      const request = await em.findOne(QuotationRequest, id, {
        lockMode: LockMode.PESSIMISTIC_WRITE,
      });
      if (!request || request.coordinationFlaggedAt) return false;
      const left = request.biddingClosesAt.getTime() - now.getTime();
      const unclaimed =
        request.coordinationOptIn && !request.coordinatorId && left <= UNCLAIMED_WINDOW_MS;
      let shortfall = false;
      if (left <= SHORTFALL_WINDOW_MS) {
        const offers = await em.find(
          ContributionOffer,
          { request, status: 'ACTIVE' },
          { fields: ['maxQuantity'] },
        );
        shortfall = offers.reduce((sum, offer) => sum + offer.maxQuantity, 0) < request.quantity;
      }
      if (!unclaimed && !shortfall) return false;
      request.coordinationFlaggedAt = now;
      const admins = request.coordinatorId
        ? [request.coordinatorId]
        : (await em.find(AppUser, { role: 'ADMIN', status: 'ACTIVE' }, { fields: ['id'] })).map(
            (admin) => admin.id,
          );
      await notify(em, 'COORDINATION_NEEDED', request.id, admins);
      return true;
    });
    if (done) flagged.push(id);
  }
  return flagged;
}
