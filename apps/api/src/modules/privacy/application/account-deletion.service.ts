import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import type { DeleteAccountRequest } from '@vcraft/contracts';
import {
  AccountInvitation,
  AppUser,
  Artisan,
  AuditLog,
  ConsentRecord,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  HouseholdRating,
  JournalEntry,
  LoginEvent,
  MediaAsset,
  MediaLink,
  News,
  Notification,
  NotificationPreference,
  OrderAllocation,
  OutboxEvent,
  Payment,
  Product,
  ProductFavourite,
  ProductMaker,
  QuotationNotice,
  QuotationRequest,
  queueKnowledgeChange,
  UnappliedPayment,
  Workshop,
} from '@vcraft/database';
import type { Actor } from '../../../common/auth/auth.guard';
import { AuthAdmin } from '../../../common/auth/auth-admin';
import { AppError, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { QuotationNotifier } from '../../rfq/application/quotation-notifier';

/** Text that replaces a delivery address on a request that has to stay as a business record. */
export const REMOVED_ADDRESS = "Removed at the buyer's request";
/** Name of a household whose representative deleted their account. */
export const REMOVED_HOUSEHOLD_NAME = 'Removed household';

/** `HouseholdRating.raterId` of a rating whose author deleted their account (the nil UUID). */
export const ANONYMOUS_RATER_ID = '00000000-0000-0000-0000-000000000000';
/** Replaces the provider payload of a payment of a deleted buyer. */
export const REDACTED_PAYMENT_EVENT = { redacted: true } as const;

const ACTIVE_ALLOCATIONS = ['PROPOSED', 'CONFIRMED', 'IN_PROGRESS'] as const;
const OPEN_REQUESTS = ['SENT', 'BIDDING'] as const;

/**
 * Self-service account deletion (NFR-SEC-07, Decree 13/2023). The person's data is deleted or
 * anonymized in one transaction; the Supabase Auth identity is deleted before that transaction commits,
 * so a failure there rolls everything back and the person can try again.
 *
 * Policy (see ADR-0017):
 * - Blocked while the person has an order in progress (buyer request `ACCEPTED`/`IN_PRODUCTION`, or a
 *   household allocation `PROPOSED`/`CONFIRMED`/`IN_PROGRESS`). Administrators do not self-delete.
 * - Deleted: email and name, consents, notifications and email choices, uploaded files (identity papers
 *   included), workshops, artisans, news and the household's profile text, buyer drafts.
 * - Anonymized, kept for the business record: the `app_user` row (a tombstone), the household row
 *   (suspended, renamed), delivery addresses of past requests, products (withdrawn, personal text removed).
 * - Untouched: orders, quotations, allocations, offers and the hash-chained production journal with the
 *   public photos its entries reference, so `verifyChain` still passes.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
    private readonly notifier: QuotationNotifier,
    private readonly authAdmin: AuthAdmin,
  ) {}

  async delete(actor: Actor, input: DeleteAccountRequest): Promise<void> {
    if (input.confirmation.trim().toLowerCase() !== actor.email.trim().toLowerCase()) {
      throw new AppError('VALIDATION_FAILED', undefined, [
        {
          path: 'confirmation',
          message: 'Hãy nhập đúng email của tài khoản để xác nhận xóa.',
          code: 'confirmation_mismatch',
        },
      ]);
    }
    if (actor.role === 'ADMIN') throw new AppError('ACCOUNT_DELETION_ADMIN');

    const removedAssets: MediaAsset[] = [];
    await this.orm.em.fork().transactional(async (em) => {
      const user = await em.findOne(AppUser, actor.id);
      if (!user || user.status === 'DELETED') throw notFound();
      const household = await em.findOne(Household, { representative: user });
      await this.assertNoActiveOrders(em, user, household);

      const hadHousehold = household !== null;
      const before = { role: user.role, status: user.status, hadHousehold };
      await this.removeBuyerData(em, user);
      if (household) await this.removeHouseholdData(em, user, household, removedAssets);
      else await this.removeMedia(em, user.id, new Set(), removedAssets);
      await this.removeInboxAndPreferences(em, user.id, removedAssets, household);

      user.email = `deleted-${user.id}@deleted.invalid`;
      user.fullName = null;
      user.username = null;
      user.status = 'DELETED';
      em.create(AuditLog, {
        actorId: user.id,
        action: 'account.delete',
        entity: 'app_user',
        entityId: user.id,
        before,
        after: { status: 'DELETED' },
      });
      await em.flush();

      // Last step before commit: if Supabase refuses, nothing above is committed and the call can be retried.
      await this.authAdmin.deleteUser(user.id);
    });

    const failed = await this.media.deleteFiles(removedAssets);
    if (failed.length > 0) {
      this.logger.error(
        `account deletion: ${failed.length} stored file(s) could not be removed, asset ids: ${failed.join(', ')}`,
      );
    }
  }

  private async assertNoActiveOrders(
    em: EntityManager,
    user: AppUser,
    household: Household | null,
  ): Promise<void> {
    const buyerOrders = await em.count(QuotationRequest, {
      buyer: user,
      status: { $in: ['ACCEPTED', 'IN_PRODUCTION'] },
    });
    const householdOrders = household
      ? await em.count(OrderAllocation, {
          household,
          status: { $in: [...ACTIVE_ALLOCATIONS] },
        })
      : 0;
    if (buyerOrders + householdOrders > 0) {
      throw new AppError(
        'ACCOUNT_DELETION_ACTIVE_ORDERS',
        'finish or cancel the orders in progress, or ask the Management Board to cancel them',
      );
    }
  }

  /** Drafts disappear, open requests are cancelled, every kept request loses its delivery address. */
  private async removeBuyerData(em: EntityManager, user: AppUser): Promise<void> {
    const requests = await em.find(QuotationRequest, { buyer: user });
    for (const request of requests) {
      if (request.status === 'DRAFT') {
        em.remove(request);
        continue;
      }
      if ((OPEN_REQUESTS as readonly string[]).includes(request.status)) {
        for (const quotation of await em.find(CooperativeQuotation, {
          request,
          status: 'SUBMITTED',
        })) {
          quotation.status = 'WITHDRAWN';
        }
        request.status = 'CANCELLED';
        request.cancelReason = 'The buyer deleted their account';
        request.revision++;
        await this.notifier.notify(em, {
          kind: 'ORDER_CANCELLED',
          requestId: request.id,
          actorId: user.id,
          recipientIds: [
            request.coordinatorId,
            ...(await this.notifier.representativeIds(em, request.invitedHouseholdIds)),
          ],
        });
      }
      request.destination = REMOVED_ADDRESS;
    }
    await this.scrubPayments(em, requests);
    await this.anonymiseRatingsGiven(em, user.id);
    await this.removeInvitation(em, user);
  }

  /** Amounts, kind, status and dates stay for accounting; provider payloads and free text go. */
  private async scrubPayments(em: EntityManager, requests: QuotationRequest[]): Promise<void> {
    if (requests.length === 0) return;
    const payments = await em.find(Payment, { order: { $in: requests } });
    for (const payment of payments) {
      if (payment.rawLastEvent) payment.rawLastEvent = { ...REDACTED_PAYMENT_EVENT };
      payment.note = null;
      payment.refundReason = null;
    }
    // Unapplied money keeps its amount for the board to give back, not the transfer text (GH#417).
    if (payments.length > 0)
      for (const row of await em.find(UnappliedPayment, { payment: { $in: payments } }))
        if (row.raw) row.raw = { ...REDACTED_PAYMENT_EVENT };
  }

  /** The score stays for the household's average; the comment and the link to the author go. */
  private async anonymiseRatingsGiven(em: EntityManager, userId: string): Promise<void> {
    for (const rating of await em.find(HouseholdRating, { raterId: userId })) {
      rating.comment = null;
      rating.raterId = ANONYMOUS_RATER_ID;
    }
  }

  /** Deletes the invitation sent to this address and masks the address in the `user.invite` audit entries. */
  private async removeInvitation(em: EntityManager, user: AppUser): Promise<void> {
    const email = user.email.trim().toLowerCase();
    const invitations = await em.find(AccountInvitation, { email });
    for (const invitation of invitations) {
      for (const entry of await em.find(AuditLog, {
        action: 'user.invite',
        entity: 'account_invitation',
        entityId: invitation.id,
      })) {
        if (entry.after && 'email' in entry.after) entry.after = { ...entry.after, email: null };
        if (entry.before && 'email' in entry.before)
          entry.before = { ...entry.before, email: null };
      }
      em.remove(invitation);
    }
  }

  private async removeHouseholdData(
    em: EntityManager,
    user: AppUser,
    household: Household,
    removedAssets: MediaAsset[],
  ): Promise<void> {
    // Offers on requests that are still open are withdrawn so the household is not allocated work later.
    const offers = await em.find(
      ContributionOffer,
      { household, status: 'ACTIVE' },
      { populate: ['request'] },
    );
    for (const offer of offers) {
      const request = offer.request;
      if (!(OPEN_REQUESTS as readonly string[]).includes(request.status)) continue;
      offer.history = [
        ...offer.history,
        {
          version: offer.version,
          maxQuantity: offer.maxQuantity,
          unitPriceVnd: offer.unitPriceVnd,
          completionDate: offer.completionDate.toISOString(),
          status: offer.status,
        },
      ];
      offer.status = 'WITHDRAWN';
      for (const quotation of await em.find(CooperativeQuotation, {
        request,
        status: 'SUBMITTED',
      })) {
        if (!quotation.parts.some((part) => part.householdId === household.id)) continue;
        quotation.status = 'WITHDRAWN';
        await this.notifier.notify(em, {
          kind: 'QUOTATION_WITHDRAWN',
          requestId: request.id,
          quotationId: quotation.id,
          actorId: user.id,
          recipientIds: [request.buyer.id, request.coordinatorId],
        });
      }
      request.revision++;
    }

    // A household's own (direct) quotations on requests that are still open go too.
    const direct = await em.find(
      CooperativeQuotation,
      {
        bidType: 'INDIVIDUAL',
        status: 'SUBMITTED',
        request: { status: { $in: [...OPEN_REQUESTS] } },
      },
      { populate: ['request'] },
    );
    for (const quotation of direct) {
      const request = quotation.request;
      if (quotation.parts[0]?.householdId !== household.id) continue;
      quotation.status = 'WITHDRAWN';
      await this.notifier.notify(em, {
        kind: 'QUOTATION_WITHDRAWN',
        requestId: request.id,
        quotationId: quotation.id,
        actorId: user.id,
        recipientIds: [request.buyer.id],
      });
      request.revision++;
    }

    const products = await em.find(Product, { household });
    const entries = products.length
      ? await em.find(JournalEntry, { product: { $in: products } })
      : [];
    // Photos that production-journal entries point to stay (their hashes are part of the chain).
    const journalPhotos = new Set(entries.flatMap((entry) => entry.images.map((i) => i.sha256)));

    if (products.length > 0) {
      for (const maker of await em.find(ProductMaker, { product: { $in: products } })) {
        em.remove(maker);
      }
    }
    for (const artisan of await em.find(Artisan, { household })) em.remove(artisan);
    for (const workshop of await em.find(Workshop, { household })) em.remove(workshop);

    const news = await em.find(News, { household });
    if (news.length > 0) {
      for (const link of await em.find(MediaLink, {
        targetType: 'NEWS',
        targetId: { $in: news.map((item) => item.id) },
      })) {
        em.remove(link);
      }
      for (const item of news) {
        em.remove(item);
        queueKnowledgeChange(em, 'NEWS', item.id);
      }
    }

    for (const product of products) {
      product.status = 'WITHDRAWN';
      product.withdrawnReason = 'The household account was deleted';
      product.artisanNote = null;
      product.coverUrl = null;
      product.coverAlt = null;
      product.coverAltEn = null;
      product.images = null;
    }

    household.name = REMOVED_HOUSEHOLD_NAME;
    household.slug = `removed-${household.id}`;
    household.history = '';
    household.idNumberEnc = null;
    household.village = null;
    household.craft = null;
    household.craftCategory = null;
    household.coverUrl = null;
    household.coverPhoto = null;
    household.portraitPhoto = null;
    household.sealPhoto = null;
    household.foundedYear = null;
    household.generations = null;
    household.timeline = null;
    household.certifications = null;
    household.gallery = null;
    household.capacityByCategory = null;
    household.status = 'SUSPENDED';
    household.statusReason = 'The representative deleted their account';
    // A household change also covers its products, so the assistant index drops them all.
    queueKnowledgeChange(em, 'HOUSEHOLD', household.id);

    await this.removeMedia(em, user.id, journalPhotos, removedAssets);
  }

  /** Delete the person's uploads, except public photos referenced by the production journal. */
  private async removeMedia(
    em: EntityManager,
    ownerId: string,
    keepSha256: ReadonlySet<string>,
    removedAssets: MediaAsset[],
  ): Promise<void> {
    const assets = await em.find(MediaAsset, { ownerId });
    if (assets.length === 0) return;
    for (const link of await em.find(MediaLink, { media: { $in: assets } })) em.remove(link);
    for (const asset of assets) {
      if (asset.visibility === 'PUBLIC' && keepSha256.has(asset.sha256)) continue;
      em.remove(asset);
      removedAssets.push(asset);
    }
  }

  private async removeInboxAndPreferences(
    em: EntityManager,
    userId: string,
    removedAssets: readonly MediaAsset[],
    household: Household | null,
  ): Promise<void> {
    const noticeIds = new Set<string>();
    for (const row of await em.find(Notification, { recipientId: userId })) {
      noticeIds.add(row.id);
      em.remove(row);
    }
    for (const row of await em.find(QuotationNotice, { recipientId: userId })) {
      noticeIds.add(row.id);
      em.remove(row);
    }
    for (const row of await em.find(NotificationPreference, { userId })) em.remove(row);
    for (const row of await em.find(ProductFavourite, { userId })) em.remove(row);
    for (const row of await em.find(ConsentRecord, { userId })) em.remove(row);
    for (const row of await em.find(LoginEvent, { userId })) em.remove(row);

    // Queued emails and image jobs for what was just deleted would only fail later.
    const assetIds = new Set(removedAssets.map((asset) => asset.id));
    const queued = await em.find(OutboxEvent, {
      status: { $in: ['PENDING', 'FAILED'] },
      type: {
        $in: ['quotation.notice', 'notification.created', 'media.uploaded', 'household.decision'],
      },
    });
    for (const event of queued) {
      const payload = event.payload;
      const ids = Array.isArray(payload.noticeIds) ? payload.noticeIds.map(String) : [];
      const drop =
        (ids.length > 0 && ids.every((id) => noticeIds.has(id))) ||
        (event.type === 'media.uploaded' && assetIds.has(String(payload.assetId))) ||
        (event.type === 'household.decision' &&
          household !== null &&
          payload.householdId === household.id);
      if (drop) em.remove(event);
    }
  }
}
