import { type EntityManager, type FilterQuery, LockMode, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  AcceptQuotationRequest,
  AllocationDto,
  AuditAction,
  BuyerQuotationDto,
  ContributionDto,
  CoordinationQueueItemDto,
  CreateContributionRequest,
  CreateCooperativeQuotationRequest,
  CreateDirectQuotationRequest,
  CreateRfqRequest,
  DirectQuotationDto,
  HouseholdRatingDto,
  ListRfqsQuery,
  MyAllocationDto,
  MyInvitationDto,
  OpenCoordinatedRequestDto,
  PriceHintDto,
  RateHouseholdRequest,
  ReportProgressRequest,
  RfqAttachmentDto,
  RfqListDto,
  RfqResponse,
} from '@vcraft/contracts';
import { compactPhone } from '@vcraft/contracts';
import {
  AppUser,
  AuditLog,
  ContributionOffer as ContributionOfferEntity,
  CooperativeQuotation as CooperativeQuotationEntity,
  Household,
  HouseholdRating,
  MediaAsset,
  MediaLink,
  OrderAllocation as OrderAllocationEntity,
  OutboxEvent,
  Payment,
  Product,
  QuotationRequest,
  resolveDbDriver,
} from '@vcraft/database';
import {
  allocationTransition,
  assembleCooperativeQuotation,
  assembleDirectQuotation,
  bidTransition,
  checkProgressReport,
  hasAcceptWindowElapsed,
  isCompletionDateValid,
  isEligibleForOpenRequest,
  isOpenCoordinatedRequest,
  isRatingEditable,
  liveShares,
  type ProductCategory,
  paymentTransition,
  projectBuyerQuotation,
  RATING_EDIT_WINDOW_DAYS,
  RFQ_ACCEPT_GRACE_MS,
  ratingEditableUntil,
  remainingCapacity,
  selectMatchingHouseholds,
  suggestPriceRange,
  transition,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { ratingSummaries } from '../../households/household-rating-stats';
import { MediaService } from '../../media/application/media.service';
import { paymentsConfig } from '../../payments/payments.config';
import { ConsentService } from '../../privacy/application/consent.service';
import { allocationTimeline } from './allocation-timeline';
import { assertWithinCapacity, committedByHousehold, declaredCapacity } from './household-capacity';
import { QuotationNotifier } from './quotation-notifier';
import {
  assertCoordinator,
  assertCoordinatorOrBoard,
  assertEligibleHouseholds,
} from './request-access';

/** All plan/input writes lock the request first, so changes cannot race with composition. */
@Injectable()
export class RfqService {
  constructor(
    private readonly orm: MikroORM,
    private readonly notifier: QuotationNotifier,
    private readonly media: MediaService,
    private readonly consents: ConsentService,
  ) {}

  /**
   * A buyer creates a request for themselves. FR-ORD-10 (GH#248 s5-10): an administrator creates one for an
   * off-platform customer and says who the customer is in `onBehalfOf`. The administrator is then the buyer of
   * record and the coordinator, so the request is always coordinated and already claimed by them.
   */
  async createRequest(actor: Actor, input: CreateRfqRequest): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    const { onBehalfOf, ...fields } = input;
    const forCustomer = actor.role === 'ADMIN';
    if (forCustomer && !onBehalfOf)
      throw new AppError('VALIDATION_FAILED', 'onBehalfOf is required for an administrator');
    if (!forCustomer && onBehalfOf)
      throw new AppError('VALIDATION_FAILED', 'onBehalfOf is only for administrators');
    // The request carries a delivery address, so it is only stored after the buyer consented (NFR-SEC-07).
    // A customer on the phone has no account to consent from; the administrator answers for the data.
    if (!forCustomer) await this.consents.require(actor.id, 'RFQ_CONTACT');
    return this.orm.em.fork().transactional(async (em) => {
      await this.checkHouseholds(em, input.invitedHouseholdIds);
      const request = em.create(QuotationRequest, {
        buyer: em.getReference(AppUser, actor.id),
        ...requestFields(fields),
        ...(forCustomer && onBehalfOf
          ? {
              coordinationOptIn: true,
              coordinatorId: actor.id,
              onBehalfName: onBehalfOf.name,
              onBehalfPhone: compactPhone(onBehalfOf.phone),
              onBehalfEmail: onBehalfOf.email ?? null,
            }
          : {}),
      });
      if (forCustomer)
        this.audit(em, actor, 'rfq.create', 'rfq', request.id, null, {
          status: request.status,
          onBehalfOfCustomer: true,
          coordinatorId: request.coordinatorId,
        });
      await em.flush();
      await this.setAttachments(em, actor, request, input.attachments);
      return withCustomer(
        toRfqResponse(request, await this.attachmentsOf(em, request.id)),
        request,
        actor,
      );
    });
  }

  /**
   * FR-RFQ-13 (vCRAFT-bda.5): the buyer copies an owned request into a fresh draft of their own
   * (GH#248 s4-12). Only editable content is copied: title, category, description, budget, special
   * requirements, quantity, unit, destination, delivery target and the invitation/coordination
   * preferences. Everything that belongs to the workflow stays behind — status, quotations, offers,
   * allocations, notices, audit trail, decline marks, the cancel reason and the flag timestamps —
   * so the copy is a brand-new request the buyer reviews before submitting. The dates are re-armed
   * to fresh draft defaults because the old ones have often expired, which would block the first
   * submit (T1). Attachments must be selected again on the new draft; file links are not copied.
   */
  async duplicateRequest(actor: Actor, id: string): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    // The copy carries the same delivery address, so the consent rule applies again (NFR-SEC-07).
    await this.consents.require(actor.id, 'RFQ_CONTACT');
    return this.orm.em.fork().transactional(async (em) => {
      const original = await this.request(em, id);
      if (original.buyer.id !== actor.id) throw notFound();
      const now = new Date();
      const copy = em.create(QuotationRequest, {
        buyer: em.getReference(AppUser, actor.id),
        title: original.title,
        category: original.category,
        design: original.design,
        customRequirements: original.customRequirements,
        quantity: original.quantity,
        unit: original.unit,
        destination: original.destination,
        budgetMinVnd: original.budgetMinVnd,
        budgetMaxVnd: original.budgetMaxVnd,
        // Fresh defaults (the same shape the web form proposes), so the draft can be reviewed,
        // edited and submitted later even when the original's dates have expired.
        biddingClosesAt: new Date(now.getTime() + 7 * 86_400_000),
        requiredBy: new Date(now.getTime() + 30 * 86_400_000),
        invitedHouseholdIds: [...(original.invitedHouseholdIds ?? [])],
        coordinationOptIn: original.coordinationOptIn,
      });
      await em.flush();
      // Attachments must be selected again so a new draft cannot revive expired or removed files.
      return toRfqResponse(copy, []);
    });
  }

  /** Autosave of a draft (FR-RFQ-02). Only the owner can change it, and only while it is a draft. */
  async updateRequest(
    actor: Actor,
    id: string,
    version: number,
    input: CreateRfqRequest,
  ): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, id, true);
      if (request.buyer.id !== actor.id) throw notFound();
      assertVersion(request, version);
      if (request.status !== 'DRAFT') throw new AppError('INVALID_TRANSITION');
      await this.checkHouseholds(em, input.invitedHouseholdIds);
      Object.assign(request, requestFields(input));
      await em.flush();
      await this.setAttachments(em, actor, request, input.attachments);
      return toRfqResponse(request, await this.attachmentsOf(em, request.id));
    });
  }

  async listRequests(actor: Actor, query: ListRfqsQuery): Promise<RfqListDto> {
    const em = this.orm.em.fork();
    const and: FilterQuery<QuotationRequest>[] = [{ buyer: actor.id }];
    const now = new Date();
    // Same bounds as `requestExpired` (T8): SENT ends at the deadline, BIDDING 7 days after it.
    const graceStart = new Date(now.getTime() - RFQ_ACCEPT_GRACE_MS);
    if (query.status === 'EXPIRED')
      and.push({
        $or: [
          { status: 'EXPIRED' },
          { status: 'SENT', biddingClosesAt: { $lte: now } },
          { status: 'BIDDING', biddingClosesAt: { $lte: graceStart } },
        ],
      });
    else if (query.status === 'SENT') and.push({ status: 'SENT', biddingClosesAt: { $gt: now } });
    else if (query.status === 'BIDDING')
      and.push({ status: 'BIDDING', biddingClosesAt: { $gt: graceStart } });
    else if (query.status) and.push({ status: query.status });
    if (query.cursor) {
      const cursor = decodeRequestCursor(query.cursor);
      const at = new Date(cursor.t);
      and.push({ $or: [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: cursor.id } }] });
    }
    const rows = await em.find(
      QuotationRequest,
      { $and: and },
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.limit + 1 },
    );
    const page = rows.slice(0, query.limit);
    const quotations = await em.find(CooperativeQuotationEntity, {
      request: { $in: page.map((request) => request.id) },
      status: 'SUBMITTED',
    });
    const counts = new Map<string, number>();
    for (const quotation of quotations)
      counts.set(quotation.request.id, (counts.get(quotation.request.id) ?? 0) + 1);
    const last = page.at(-1);
    return {
      data: page.map((request) => ({
        ...toRfqResponse(request),
        openQuotationCount: requestExpired(request) ? 0 : (counts.get(request.id) ?? 0),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(JSON.stringify({ t: last.createdAt.toISOString(), id: last.id })).toString(
              'base64url',
            )
          : null,
    };
  }

  async getRequest(actor: Actor, id: string): Promise<RfqResponse> {
    const em = this.orm.em.fork();
    const request = await this.request(em, id);
    await this.canRead(em, actor, request);
    const response = toRfqResponse(request, await this.attachmentsOf(em, request.id));
    response.hasBids = (await em.count(CooperativeQuotationEntity, { request })) > 0;
    withCustomer(response, request, actor);
    await this.addOwnRatings(em, actor, request, response);
    if (actor.role === 'HOUSEHOLD') {
      const household = await this.ownHousehold(em, actor, false);
      response.invitedHouseholdIds = [household.id];
      response.declinedByMe = (request.declinedHouseholdIds ?? []).includes(household.id);
    }
    return response;
  }

  /** The household's invitations (FR-RFQ-04), open ones first by the nearest deadline. */
  async listInvitations(actor: Actor): Promise<MyInvitationDto[]> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor, false);
    // `invitedHouseholdIds` is a JSON column: the driver-specific "contains" runs in the database, so
    // only this household's invitations are loaded, however many other requests exist.
    const contains =
      resolveDbDriver(process.env) === 'mysql'
        ? 'json_contains(invited_household_ids, json_quote(?))'
        : 'invited_household_ids @> ?::jsonb';
    const rows = (await em
      .getConnection()
      .execute(`select id from quotation_request where status <> 'DRAFT' and ${contains}`, [
        resolveDbDriver(process.env) === 'mysql' ? household.id : JSON.stringify([household.id]),
      ])) as Array<{ id: string }>;
    const requests = rows.length
      ? await em.find(
          QuotationRequest,
          { id: { $in: rows.map((row) => row.id) } },
          { orderBy: { biddingClosesAt: 'desc' } },
        )
      : [];
    const offers = await em.find(
      ContributionOfferEntity,
      { household, request: { $in: requests.map((request) => request.id) } },
      { populate: ['household'] },
    );
    const byRequest = new Map(offers.map((offer) => [offer.request.id, offer]));
    const direct = new Map<string, CooperativeQuotationEntity>();
    for (const quotation of await em.find(
      CooperativeQuotationEntity,
      { request: { $in: requests.map((request) => request.id) }, bidType: 'INDIVIDUAL' },
      { populate: ['request'], orderBy: { createdAt: 'desc' } },
    ))
      if (ownsDirectQuotation(quotation, household.id) && !direct.has(quotation.request.id))
        direct.set(quotation.request.id, quotation);
    const withBids = new Set(
      (
        await em.find(
          CooperativeQuotationEntity,
          { request: { $in: requests.map((request) => request.id) } },
          { fields: ['request'] },
        )
      ).map((quotation) => quotation.request.id),
    );
    const isOpen = (request: QuotationRequest) =>
      (request.status === 'SENT' || request.status === 'BIDDING') && !requestExpired(request);
    return requests
      .sort(
        (a, b) =>
          Number(isOpen(b)) - Number(isOpen(a)) ||
          (isOpen(a) ? 1 : -1) * (a.biddingClosesAt.getTime() - b.biddingClosesAt.getTime()),
      )
      .map((request) => {
        const offer = byRequest.get(request.id);
        const quotation = direct.get(request.id);
        return {
          request: {
            ...toRfqResponse(request),
            invitedHouseholdIds: [household.id],
            hasBids: withBids.has(request.id),
          },
          contribution: offer ? toContributionDto(offer) : null,
          declined: (request.declinedHouseholdIds ?? []).includes(household.id),
          directQuotation: quotation ? toDirectQuotationDto(quotation) : null,
        };
      });
  }

  /**
   * BR-05a: coordinated requests an administrator claimed that still take offers and that match the
   * household's craft categories, as redacted summaries. Requests the household is already invited to
   * are left out (they are in its invitations). Never carries buyer identity, budget or free text.
   */
  async listOpenCoordinatedRequests(actor: Actor): Promise<OpenCoordinatedRequestDto[]> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor, false);
    if (household.status !== 'APPROVED' || actor.locked) return [];
    const published = await this.publishedByCategory(em, household.id);
    const categories = new Set<ProductCategory>(published.keys());
    for (const [category, capacity] of Object.entries(household.capacityByCategory ?? {}))
      if ((capacity ?? 0) > 0) categories.add(category as ProductCategory);
    if (categories.size === 0) return [];
    const now = new Date();
    const requests = await em.find(
      QuotationRequest,
      {
        coordinationOptIn: true,
        coordinatorId: { $ne: null },
        status: { $in: ['SENT', 'BIDDING'] },
        biddingClosesAt: { $gt: now },
        category: { $in: [...categories] },
      },
      { orderBy: { biddingClosesAt: 'asc' } },
    );
    return requests
      .filter(
        (request) =>
          isOpenCoordinatedRequest(request, now) &&
          !request.invitedHouseholdIds.includes(household.id) &&
          isEligibleForOpenRequest({
            householdStatus: household.status,
            representativeLocked: false,
            requestCategory: request.category,
            declaredCapacity: declaredCapacity(household, request.category),
            publishedProducts: published.get(request.category as ProductCategory) ?? 0,
          }),
      )
      .map((request) => ({
        id: request.id,
        category: request.category as ProductCategory,
        quantity: request.quantity,
        unit: request.unit,
        biddingClosesAt: request.biddingClosesAt.toISOString(),
        requiredBy: request.requiredBy.toISOString(),
      }));
  }

  /** An invited household says no (FR-RFQ-04). It can still send an offer before the deadline. */
  async declineInvitation(actor: Actor, id: string) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, id, true);
      const household = await this.ownHousehold(em, actor);
      if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
      this.open(request);
      const active = await em.count(ContributionOfferEntity, {
        request,
        household,
        status: 'ACTIVE',
      });
      if (active > 0) throw new AppError('INVALID_TRANSITION', 'withdraw the active offer first');
      const declined = request.declinedHouseholdIds ?? [];
      if (!declined.includes(household.id))
        request.declinedHouseholdIds = [...declined, household.id];
      await em.flush();
      return {
        ...toRfqResponse(request),
        invitedHouseholdIds: [household.id],
        declinedByMe: true,
      };
    });
  }

  /** The household's own shares across orders (FR-ORD-05 … 07), newest first. */
  async listMyAllocations(actor: Actor): Promise<MyAllocationDto[]> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor, false);
    const allocations = await em.find(
      OrderAllocationEntity,
      { household },
      { populate: ['household', 'quotation.request'], orderBy: { createdAt: 'desc' }, limit: 500 },
    );
    return allocations.map((allocation) => {
      const request = allocation.quotation.request;
      const part = allocation.quotation.parts.find((p) => p.householdId === household.id);
      return {
        ...toAllocationDto(allocation),
        requestId: request.id,
        requestTitle: request.title ?? request.design,
        requestStatus: toRfqResponse(request).status,
        unit: request.unit,
        requiredBy: request.requiredBy.toISOString(),
        completionDate: part?.completionDate ?? null,
      };
    });
  }

  async submitRequest(actor: Actor, id: string, version: number): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, id, true);
      if (request.buyer.id !== actor.id) throw notFound();
      assertVersion(request, version);
      // BR-05: with no chosen household and no coordination the system invites households of the category.
      if (request.invitedHouseholdIds.length === 0 && !request.coordinationOptIn) {
        const matched = await this.matchHouseholds(em, request);
        if (matched.length === 0) throw new AppError('RFQ_NO_MATCHING_HOUSEHOLD');
        request.invitedHouseholdIds = matched;
      }
      await this.checkHouseholds(em, request.invitedHouseholdIds);
      request.status = unwrap(
        transition(request.status, 'SUBMIT', {
          actor: 'BUYER_OWNER',
          now: new Date(),
          emailVerified: actor.emailVerified === true,
          biddingClosesAt: request.biddingClosesAt,
          requiredBy: request.requiredBy,
        }),
      );
      await this.notifier.notify(em, {
        kind: 'RFQ_INVITED',
        requestId: request.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(em, request.invitedHouseholdIds),
      });
      // The worker schedules `rfq.expire` at the deadline from this event (PLAN E9).
      em.create(OutboxEvent, {
        type: 'rfq.submitted',
        payload: { requestId: request.id, biddingClosesAt: request.biddingClosesAt.toISOString() },
      });
      await em.flush();
      return toRfqResponse(request, await this.attachmentsOf(em, request.id));
    });
  }

  async coordinate(actor: Actor, id: string, version: number) {
    if (actor.locked) throw forbidden();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, id, true);
      if (
        !request.coordinationOptIn ||
        (request.coordinatorId && request.coordinatorId !== actor.id)
      )
        throw notFound();
      assertVersion(request, version);
      this.open(request);
      const previous = request.coordinatorId ?? null;
      request.coordinatorId = actor.id;
      if (previous !== actor.id)
        this.audit(
          em,
          actor,
          'rfq.claim',
          'rfq',
          request.id,
          { coordinatorId: previous },
          {
            coordinatorId: actor.id,
          },
        );
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  async invite(actor: Actor, id: string, version: number, householdIds: string[]) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, id, true);
      this.coordinator(actor, request);
      assertVersion(request, version);
      this.open(request);
      await this.checkHouseholds(em, householdIds);
      const added = [...new Set(householdIds)].filter(
        (householdId) => !request.invitedHouseholdIds.includes(householdId),
      );
      const invitedBefore = request.invitedHouseholdIds;
      request.invitedHouseholdIds = [...invitedBefore, ...added];
      this.audit(
        em,
        actor,
        'rfq.invite',
        'rfq',
        request.id,
        { invitedHouseholdIds: invitedBefore },
        {
          invitedHouseholdIds: request.invitedHouseholdIds,
        },
      );
      await this.notifier.notify(em, {
        kind: 'RFQ_INVITED',
        requestId: request.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(em, added),
      });
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  async getCoordination(actor: Actor, id: string) {
    const em = this.orm.em.fork();
    const request = await this.request(em, id);
    this.coordinator(actor, request);
    const offers = await em.find(
      ContributionOfferEntity,
      { request },
      { populate: ['household'], orderBy: { createdAt: 'asc' } },
    );
    const response = withCustomer(toRfqResponse(request), request, actor);
    await this.addOwnRatings(em, actor, request, response);
    return {
      request: response,
      contributions: offers.map((offer) => ({
        ...toContributionDto(offer),
        householdName: offer.household.name,
        householdCapacity: declaredCapacity(offer.household, request.category) ?? null,
      })),
    };
  }

  async createContribution(
    actor: Actor,
    requestId: string,
    input: CreateContributionRequest,
  ): Promise<ContributionDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      this.open(request);
      const household = await this.ownHousehold(em, actor);
      if (!request.invitedHouseholdIds.includes(household.id)) {
        // BR-05a: without an invitation the request stays invisible unless it is an open coordinated one.
        if (!isOpenCoordinatedRequest(request)) throw notFound();
        const published = await this.publishedByCategory(em, household.id);
        if (
          !isEligibleForOpenRequest({
            householdStatus: household.status,
            representativeLocked: actor.locked,
            requestCategory: request.category,
            declaredCapacity: declaredCapacity(household, request.category),
            publishedProducts: published.get(request.category as ProductCategory) ?? 0,
          })
        )
          throw new AppError('RFQ_ARTISAN_NOT_ELIGIBLE');
        request.invitedHouseholdIds = [...request.invitedHouseholdIds, household.id];
      }
      if (household.status !== 'APPROVED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
      this.completion(input.completionDate, request);
      const committed = await committedByHousehold(
        em,
        [household.id],
        request.category,
        request.id,
      );
      assertWithinCapacity(
        household,
        request.category,
        input.maxQuantity,
        committed.get(household.id) ?? 0,
      );
      request.declinedHouseholdIds = (request.declinedHouseholdIds ?? []).filter(
        (id) => id !== household.id,
      );
      const offer = em.create(ContributionOfferEntity, {
        request,
        household,
        maxQuantity: input.maxQuantity,
        unitPriceVnd: input.unitPriceVnd,
        completionDate: new Date(input.completionDate),
      });
      await this.notifier.notify(em, {
        kind: 'CONTRIBUTION_RECEIVED',
        requestId: request.id,
        actorId: actor.id,
        recipientIds: [request.coordinatorId],
      });
      request.revision++;
      await em.flush();
      return toContributionDto(offer);
    });
  }

  /**
   * A unit price hint for an invited household writing its offer (PLAN E9): its own offers on other
   * requests and published prices of comparable products, both in the request's category when it has
   * one. Never reads another household's offer, so nothing sealed can leak through the range.
   */
  async priceHint(actor: Actor, requestId: string): Promise<PriceHintDto> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    const household = await this.ownHousehold(em, actor, false);
    if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
    const category = request.category ?? undefined;
    const [own, catalog] = await Promise.all([
      em.find(
        ContributionOfferEntity,
        {
          household,
          request: { id: { $ne: request.id }, ...(category ? { category } : {}) },
        },
        { fields: ['unitPriceVnd'], orderBy: { createdAt: 'desc' }, limit: 50 },
      ),
      em.find(
        Product,
        {
          status: 'PUBLISHED',
          household: { status: 'APPROVED' },
          priceVnd: { $gt: 0 },
          ...(category ? { category } : {}),
        },
        { fields: ['priceVnd'], orderBy: { publishedAt: 'desc' }, limit: 200 },
      ),
    ]);
    return {
      hint: suggestPriceRange(
        own.map((offer) => offer.unitPriceVnd),
        catalog.map((product) => product.priceVnd),
      ),
    };
  }

  async listContributions(actor: Actor, requestId: string): Promise<ContributionDto[]> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    if (actor.role === 'ADMIN') this.coordinator(actor, request);
    else if (actor.role !== 'HOUSEHOLD') throw forbidden();
    const household =
      actor.role === 'HOUSEHOLD' ? await this.ownHousehold(em, actor, false) : undefined;
    if (household && !request.invitedHouseholdIds.includes(household.id)) throw notFound();
    const offers = await em.find(
      ContributionOfferEntity,
      { request, ...(household ? { household } : {}) },
      {
        populate: ['household'],
        orderBy: { createdAt: 'asc' },
      },
    );
    return offers.map(toContributionDto);
  }

  async updateContribution(
    actor: Actor,
    id: string,
    version: number,
    input: CreateContributionRequest,
  ) {
    return this.changeContribution(actor, id, version, input);
  }

  async withdrawContribution(actor: Actor, id: string, version: number) {
    return this.changeContribution(actor, id, version);
  }

  private async changeContribution(
    actor: Actor,
    id: string,
    version: number,
    input?: CreateContributionRequest,
  ) {
    // Read the immutable request ID before BEGIN. Under MySQL REPEATABLE READ, a normal
    // read inside the transaction before the lock would retain an obsolete quotation snapshot.
    const reference = await this.orm.em.fork().findOne(ContributionOfferEntity, id);
    if (!reference) throw notFound();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, reference.request.id, true);
      const offer = await em.findOneOrFail(ContributionOfferEntity, id, {
        populate: ['household'],
        refresh: true,
      });
      const household = await this.ownHousehold(em, actor);
      if (offer.household.id !== household.id) throw notFound();
      assertVersion(offer, version);
      this.open(request);
      if (input && household.status !== 'APPROVED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
      if (input) {
        this.completion(input.completionDate, request);
        const committed = await committedByHousehold(
          em,
          [household.id],
          request.category,
          request.id,
        );
        assertWithinCapacity(
          household,
          request.category,
          input.maxQuantity,
          committed.get(household.id) ?? 0,
        );
      }
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
      if (input) {
        offer.maxQuantity = input.maxQuantity;
        offer.unitPriceVnd = input.unitPriceVnd;
        offer.completionDate = new Date(input.completionDate);
        offer.status = 'ACTIVE';
      } else offer.status = 'WITHDRAWN';
      const quotations = await em.find(CooperativeQuotationEntity, {
        request,
        status: 'SUBMITTED',
      });
      for (const quotation of quotations) {
        if (!quotation.parts.some((part) => part.householdId === household.id)) continue;
        quotation.status = 'WITHDRAWN';
        await this.notifier.notify(em, {
          kind: 'QUOTATION_WITHDRAWN',
          requestId: request.id,
          quotationId: quotation.id,
          actorId: actor.id,
          recipientIds: [request.buyer.id, request.coordinatorId],
        });
      }
      if (input)
        await this.notifier.notify(em, {
          kind: 'CONTRIBUTION_RECEIVED',
          requestId: request.id,
          actorId: actor.id,
          recipientIds: [request.coordinatorId],
        });
      request.revision++;
      await em.flush();
      return toContributionDto(offer);
    });
  }

  async contributionHistory(actor: Actor, id: string) {
    const em = this.orm.em.fork();
    const offer = await em.findOne(ContributionOfferEntity, id, {
      populate: ['household', 'request'],
    });
    if (!offer) throw notFound();
    if (actor.role === 'ADMIN') this.coordinator(actor, offer.request);
    else if (offer.household.representative.id !== actor.id) throw notFound();
    return [
      ...offer.history,
      {
        version: offer.version,
        maxQuantity: offer.maxQuantity,
        unitPriceVnd: offer.unitPriceVnd,
        completionDate: offer.completionDate.toISOString(),
        status: offer.status,
      },
    ];
  }

  /**
   * FR-RFQ-04, BR-L3: an invited household of a request without coordination quotes the whole quantity
   * itself. One active quotation per household and request; the first quotation moves the request to
   * BIDDING (T2). The buyer accepts it like any other quotation.
   */
  async createDirectQuotation(
    actor: Actor,
    requestId: string,
    input: CreateDirectQuotationRequest,
  ): Promise<DirectQuotationDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      this.open(request);
      const household = await this.directQuotingHousehold(em, actor, request);
      if (household.status !== 'APPROVED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
      const existing = await this.activeDirectQuotation(em, request, household.id);
      if (existing) throw new AppError('RFQ_BID_ALREADY_EXISTS');
      const plan = this.directPlan(request, household, input);
      if (request.status === 'SENT')
        request.status = unwrap(
          transition(request.status, 'RECEIVE_BID', {
            actor: 'ARTISAN',
            now: new Date(),
            biddingClosesAt: request.biddingClosesAt,
            hasBidFromArtisan: false,
          }),
        );
      request.declinedHouseholdIds = (request.declinedHouseholdIds ?? []).filter(
        (id) => id !== household.id,
      );
      const entity = em.create(CooperativeQuotationEntity, {
        request,
        bidType: 'INDIVIDUAL',
        note: input.note || null,
        ...plan,
      });
      await this.notifier.notify(em, {
        kind: 'QUOTATION_RECEIVED',
        requestId: request.id,
        quotationId: entity.id,
        actorId: actor.id,
        recipientIds: [request.buyer.id],
      });
      request.revision++;
      await em.flush();
      return toDirectQuotationDto(entity);
    });
  }

  /** The household's own direct quotations on a request, newest first (the first one is current). */
  async listOwnDirectQuotations(actor: Actor, requestId: string): Promise<DirectQuotationDto[]> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    const household = await this.ownHousehold(em, actor, false);
    if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
    const rows = await em.find(
      CooperativeQuotationEntity,
      { request, bidType: 'INDIVIDUAL' },
      { populate: ['request'], orderBy: { createdAt: 'desc' } },
    );
    return rows.filter((row) => ownsDirectQuotation(row, household.id)).map(toDirectQuotationDto);
  }

  /** BR-L3/L4: the household revises its active quotation before the deadline (the version goes up). */
  async reviseDirectQuotation(
    actor: Actor,
    id: string,
    version: number,
    input: CreateDirectQuotationRequest,
  ): Promise<DirectQuotationDto> {
    return this.changeDirectQuotation(actor, id, version, input);
  }

  /** FR-RFQ-05: the household withdraws its quotation while the request is open. */
  async withdrawDirectQuotation(actor: Actor, id: string, version: number) {
    return this.changeDirectQuotation(actor, id, version);
  }

  private async changeDirectQuotation(
    actor: Actor,
    id: string,
    version: number,
    input?: CreateDirectQuotationRequest,
  ): Promise<DirectQuotationDto> {
    // Read the immutable request ID before BEGIN, as changeContribution does (MySQL REPEATABLE READ).
    const reference = await this.orm.em.fork().findOne(CooperativeQuotationEntity, id);
    if (reference?.bidType !== 'INDIVIDUAL') throw notFound();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, reference.request.id, true);
      const quotation = await em.findOneOrFail(CooperativeQuotationEntity, id, {
        populate: ['request'],
        refresh: true,
      });
      const household = await this.directQuotingHousehold(em, actor, request);
      if (!ownsDirectQuotation(quotation, household.id)) throw notFound();
      assertVersion(quotation, version);
      this.open(request);
      const event = input ? 'REVISE' : 'WITHDRAW';
      quotation.status = unwrap(
        bidTransition(quotation.status, event, {
          rfqStatus: request.status,
          biddingClosesAt: request.biddingClosesAt,
          now: new Date(),
        }),
      );
      if (input) {
        if (household.status !== 'APPROVED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
        const plan = this.directPlan(request, household, input);
        quotation.parts = plan.parts;
        quotation.productionTotalVnd = plan.productionTotalVnd;
        quotation.totalVnd = plan.totalVnd;
        quotation.note = input.note || null;
      }
      await this.notifier.notify(em, {
        kind: input ? 'QUOTATION_RECEIVED' : 'QUOTATION_WITHDRAWN',
        requestId: request.id,
        quotationId: quotation.id,
        actorId: actor.id,
        recipientIds: [request.buyer.id],
      });
      request.revision++;
      await em.flush();
      return toDirectQuotationDto(quotation);
    });
  }

  /** The stored shape of a household's quotation for the whole request, checked by the domain. */
  private directPlan(
    request: QuotationRequest,
    household: Household,
    input: CreateDirectQuotationRequest,
  ) {
    this.completion(input.completionDate, request);
    const plan = unwrap(
      assembleDirectQuotation({
        requiredQuantity: request.quantity,
        biddingClosesAt: request.biddingClosesAt,
        requiredBy: request.requiredBy,
        householdId: household.id,
        unitPriceVnd: input.unitPriceVnd,
        completionDate: new Date(input.completionDate),
        capacity: declaredCapacity(household, request.category),
      }),
    );
    return {
      quantity: plan.quantity,
      parts: plan.parts.map((part) => ({
        ...part,
        completionDate: part.completionDate.toISOString(),
      })),
      productionTotalVnd: plan.productionTotalVnd,
      additionalChargeVnd: plan.additionalChargeVnd,
      totalVnd: plan.totalVnd,
      deliveryTerms: plan.deliveryTerms,
    };
  }

  async createCooperativeQuotation(
    actor: Actor,
    requestId: string,
    version: number,
    input: CreateCooperativeQuotationRequest,
  ) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      this.coordinator(actor, request);
      assertVersion(request, version);
      this.open(request);
      const offers = await em.find(
        ContributionOfferEntity,
        { request, status: 'ACTIVE' },
        { populate: ['household'] },
      );
      await this.checkHouseholds(
        em,
        input.parts.map((part) => part.householdId),
      );
      const committed = await committedByHousehold(
        em,
        offers.map((offer) => offer.household.id),
        request.category,
        request.id,
      );
      const quotation = unwrap(
        assembleCooperativeQuotation({
          requiredQuantity: request.quantity,
          biddingClosesAt: request.biddingClosesAt,
          requiredBy: request.requiredBy,
          contributions: offers.map((offer) => ({
            householdId: offer.household.id,
            maxQuantity: offer.maxQuantity,
            unitPriceVnd: offer.unitPriceVnd,
            completionDate: offer.completionDate,
            version: offer.version,
            capacity: remainingCapacity(
              declaredCapacity(offer.household, request.category),
              committed.get(offer.household.id) ?? 0,
            ),
          })),
          parts: input.parts.map((part) => ({
            ...part,
            completionDate: new Date(part.completionDate),
          })),
          additionalChargeVnd: input.additionalChargeVnd,
          deliveryTerms: input.deliveryTerms,
        }),
      );
      // A replacement retains every old quotation for history.
      for (const previous of await em.find(CooperativeQuotationEntity, {
        request,
        status: 'SUBMITTED',
      }))
        previous.status = 'WITHDRAWN';
      const entity = em.create(CooperativeQuotationEntity, {
        request,
        quantity: quotation.quantity,
        parts: quotation.parts.map((part) => ({
          ...part,
          completionDate: part.completionDate.toISOString(),
        })),
        productionTotalVnd: quotation.productionTotalVnd,
        additionalChargeVnd: quotation.additionalChargeVnd,
        totalVnd: quotation.totalVnd,
        deliveryTerms: quotation.deliveryTerms,
      });
      request.status = 'BIDDING';
      this.audit(em, actor, 'rfq.quotation_submit', 'quotation', entity.id, null, {
        requestId: request.id,
        quantity: entity.quantity,
        totalVnd: entity.totalVnd,
        deliveryTerms: entity.deliveryTerms,
      });
      await this.notifier.notify(em, {
        kind: 'QUOTATION_RECEIVED',
        requestId: request.id,
        quotationId: entity.id,
        actorId: actor.id,
        recipientIds: [request.buyer.id],
      });
      request.revision++;
      await em.flush();
      return toInternalQuotationDto(entity, householdNames(offers.map((o) => o.household)));
    });
  }

  async listQuotations(
    actor: Actor,
    requestId: string,
  ): Promise<BuyerQuotationDto[] | ReturnType<typeof toInternalQuotationDto>[]> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    if (actor.role === 'ADMIN') this.coordinator(actor, request);
    else if (actor.role !== 'BUYER' || request.buyer.id !== actor.id) throw notFound();
    const quotations = await em.find(
      CooperativeQuotationEntity,
      { request },
      { orderBy: { createdAt: 'asc' } },
    );
    const names = householdNames(
      await em.find(Household, {
        id: { $in: [...new Set(quotations.flatMap((q) => q.parts.map((p) => p.householdId)))] },
      }),
    );
    if (actor.role === 'ADMIN')
      return quotations.map((quotation) => toInternalQuotationDto(quotation, names));
    return quotations.map((quotation) => toBuyerQuotationDto(quotation, names));
  }

  /**
   * GH#11: buyer chốt chào giá. Một giao dịch: khóa request, kiểm version, RFQ
   * BIDDING→ACCEPTED, quotation chọn →ACCEPTED, còn lại →REJECTED, sinh
   * allocations PROPOSED từ parts. Version cũ ⇒ STALE_VERSION.
   */
  async acceptQuotation(
    actor: Actor,
    requestId: string,
    version: number,
    input: AcceptQuotationRequest,
  ) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (!this.isOwner(actor, request)) throw notFound();
      if (actor.locked) throw forbidden();
      assertVersion(request, version);
      const quotations = await em.find(
        CooperativeQuotationEntity,
        { request, status: 'SUBMITTED' },
        { populate: ['request'] },
      );
      const chosen = quotations.find((quotation) => quotation.id === input.quotationId);
      if (!chosen) throw notFound();
      request.status = unwrap(
        transition(request.status, 'ACCEPT_BID', {
          actor: 'BUYER_OWNER',
          now: new Date(),
          emailVerified: actor.emailVerified === true,
          biddingClosesAt: request.biddingClosesAt,
          requiredBy: request.requiredBy,
          quantity: request.quantity,
          bid: { status: 'SUBMITTED', quantityOffered: chosen.quantity },
        }),
      );
      for (const quotation of quotations) {
        if (quotation.id === chosen.id) quotation.status = 'ACCEPTED';
        else quotation.status = 'REJECTED';
      }
      if (chosen.parts.length === 0)
        throw new AppError('BUSINESS_RULE_VIOLATED', 'ACCEPT_EMPTY_PLAN');
      const partHouseholds = chosen.parts.map((part) => part.householdId);
      // A household's own quotation is accepted only while that household is still eligible (BR-02).
      await this.checkHouseholds(em, partHouseholds);
      const names = new Map(
        (await em.find(Household, { id: { $in: [...new Set(partHouseholds)] } })).map(
          (household) => [household.id, household],
        ),
      );
      // BR-L6: capacity can shrink, or other orders can use it up, after the quotation was written.
      const committed = await committedByHousehold(
        em,
        partHouseholds,
        request.category,
        request.id,
      );
      for (const part of chosen.parts) {
        const household = names.get(part.householdId);
        if (!household) throw new AppError('BUSINESS_RULE_VIOLATED', 'ACCEPT_UNKNOWN_HOUSEHOLD');
        assertWithinCapacity(
          household,
          request.category,
          part.quantity,
          committed.get(household.id) ?? 0,
        );
        em.create(OrderAllocationEntity, {
          quotation: chosen,
          household,
          quantity: part.quantity,
          completedQty: 0,
        });
      }
      await this.notifier.notify(em, {
        kind: 'ALLOCATION_PROPOSED',
        requestId: request.id,
        quotationId: chosen.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(
          em,
          chosen.parts.map((part) => part.householdId),
        ),
      });
      // FR-RFQ-08: every other invited household learns that the buyer chose another offer.
      const chosenHouseholds = new Set(partHouseholds);
      await this.notifier.notify(em, {
        kind: 'RFQ_NOT_SELECTED',
        requestId: request.id,
        quotationId: chosen.id,
        actorId: actor.id,
        recipientIds: await this.notifier.representativeIds(
          em,
          request.invitedHouseholdIds.filter((householdId) => !chosenHouseholds.has(householdId)),
        ),
      });
      await this.notifier.notify(em, {
        kind: 'QUOTATION_ACCEPTED',
        requestId: request.id,
        quotationId: chosen.id,
        actorId: actor.id,
        recipientIds: [request.coordinatorId],
      });
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  /**
   * GH#11: đọc allocations của đơn đã chốt. Buyer chủ, admin điều phối, hoặc hộ có phần.
   * Empty (not 404) until a quotation is accepted, for anyone allowed to view the request.
   */
  async listAllocations(actor: Actor, requestId: string): Promise<AllocationDto[]> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    const accepted = await em.findOne(
      CooperativeQuotationEntity,
      { request, status: 'ACCEPTED' },
      { populate: ['request'] },
    );
    if (actor.role === 'ADMIN') this.coordinator(actor, request);
    else if (actor.role === 'BUYER' && request.buyer.id === actor.id) {
      // Buyer chủ đọc toàn bộ allocations.
    } else if (actor.role === 'HOUSEHOLD') {
      const household = await this.ownHousehold(em, actor, false);
      if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
    } else throw notFound();
    // Before a quotation is accepted there is nothing to allocate yet: an empty list, not a 404.
    if (!accepted) return [];
    const allocations = await em.find(
      OrderAllocationEntity,
      { quotation: accepted },
      { populate: ['household', 'quotation.request'], orderBy: { createdAt: 'asc' } },
    );
    if (actor.role === 'HOUSEHOLD') {
      const household = await this.ownHousehold(em, actor, false);
      return allocations
        .filter((allocation) => allocation.household.id === household.id)
        .map(toAllocationDto);
    }
    return allocations.map(toAllocationDto);
  }

  /**
   * GH#11: hộ CONFIRM phân bổ PROPOSED của mình. Khóa request trước (BR-L2),
   * kiểm version allocation; giao dịch duy nhất.
   */
  async confirmAllocation(actor: Actor, allocationId: string, version: number) {
    return this.orm.em.fork().transactional(async (em) => {
      const allocation = await this.allocation(em, allocationId);
      const request = await this.request(em, allocation.quotation.request.id, true);
      const household = await this.ownHousehold(em, actor);
      if (allocation.household.id !== household.id) throw notFound();
      assertVersion(allocation, version);
      this.acceptedOnly(request);
      allocation.status = unwrap(allocationTransition(allocation.status, 'CONFIRM', {}));
      await this.notifier.notify(em, {
        kind: 'ALLOCATION_CONFIRMED',
        requestId: request.id,
        quotationId: allocation.quotation.id,
        actorId: actor.id,
        recipientIds: [request.buyer.id, request.coordinatorId],
      });
      request.revision++;
      await em.flush();
      return toAllocationDto(allocation);
    });
  }

  /**
   * GH#11: hộ DECLINE phân bổ PROPOSED của mình ⇒ hủy cả đơn chưa sản xuất
   * (request ACCEPTED→CANCELLED, mọi allocation còn hiệu lực →CANCELLED).
   * Lịch sử giữ nguyên (không xóa hàng).
   */
  async declineAllocation(actor: Actor, allocationId: string, version: number) {
    return this.orm.em.fork().transactional(async (em) => {
      const allocation = await this.allocation(em, allocationId);
      const request = await this.request(em, allocation.quotation.request.id, true);
      const household = await this.ownHousehold(em, actor);
      if (allocation.household.id !== household.id) throw notFound();
      assertVersion(allocation, version);
      this.acceptedOnly(request);
      allocation.status = unwrap(allocationTransition(allocation.status, 'DECLINE', {}));
      // FR-ORD-05 (GH#246): one household saying no does not end the order. It stays ACCEPTED, the other
      // shares keep their state, and the coordinator reallocates the declined quantity before production.
      // Without a coordinator (a household's own quotation) every active admin is asked instead.
      await this.notifier.notify(em, {
        kind: 'COORDINATION_NEEDED',
        requestId: request.id,
        quotationId: allocation.quotation.id,
        actorId: actor.id,
        recipientIds: request.coordinatorId
          ? [request.coordinatorId]
          : (await em.find(AppUser, { role: 'ADMIN', status: 'ACTIVE' }, { fields: ['id'] })).map(
              (admin) => admin.id,
            ),
      });
      request.revision++;
      await em.flush();
      return toAllocationDto(allocation);
    });
  }

  /**
   * GH#11: hộ báo cáo tiến độ theo phân bổ IN_PROGRESS của mình.
   * completedQty phải nằm trong 0..quantity; đủ số ⇒ DONE.
   */
  async reportProgress(
    actor: Actor,
    allocationId: string,
    version: number,
    input: ReportProgressRequest,
  ) {
    const { completedQty } = input;
    let photoUrl: string | null = null;
    if (input.photoMediaId) {
      const owned = await this.media.ownedBy(actor.id, [input.photoMediaId]);
      photoUrl = owned.has(input.photoMediaId)
        ? ((await this.media.publicUrls([input.photoMediaId])).get(input.photoMediaId) ?? null)
        : null;
      if (!photoUrl) throw new AppError('VALIDATION_FAILED', 'photo is not available');
    }
    return this.orm.em.fork().transactional(async (em) => {
      const allocation = await this.allocation(em, allocationId);
      const request = await this.request(em, allocation.quotation.request.id, true);
      const household = await this.ownHousehold(em, actor);
      if (allocation.household.id !== household.id) throw notFound();
      assertVersion(allocation, version);
      if (request.status !== 'IN_PRODUCTION') throw new AppError('INVALID_TRANSITION');
      if (allocation.status !== 'IN_PROGRESS') throw new AppError('INVALID_TRANSITION');
      const check = checkProgressReport(allocation.quantity, completedQty);
      if (!check.ok) throw new AppError('VALIDATION_FAILED', 'completedQty out of range');
      allocation.completedQty = completedQty;
      allocation.progressLog = [
        ...(allocation.progressLog ?? []),
        { at: new Date().toISOString(), completedQty, note: input.note ?? null, photoUrl },
      ];
      if (completedQty === allocation.quantity) {
        allocation.status = unwrap(
          allocationTransition(allocation.status, 'COMPLETE', {
            quantity: allocation.quantity,
            completedQty,
          }),
        );
      }
      await this.notifier.notify(em, {
        kind: 'PROGRESS_REPORTED',
        requestId: request.id,
        quotationId: allocation.quotation.id,
        actorId: actor.id,
        recipientIds: [request.buyer.id, request.coordinatorId],
      });
      request.revision++;
      await em.flush();
      return toAllocationDto(allocation);
    });
  }

  /**
   * Cancels a request with a required reason: the owning buyer before production (T6, FR-RFQ-09),
   * or the coordinator after acceptance (T7). Open quotations and live allocations end with it.
   */
  async cancelOrder(actor: Actor, requestId: string, version: number, reason = '') {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (actor.locked) throw forbidden();
      // An administrator who owns the request for a customer cancels as the buyer before acceptance (T6)
      // and as the board after it (T7).
      const owner =
        this.isOwner(actor, request) &&
        (actor.role === 'BUYER' || ['DRAFT', 'SENT', 'BIDDING'].includes(request.status));
      if (!owner) this.coordinatorOrBoard(actor, request);
      assertVersion(request, version);
      if (requestExpired(request)) throw new AppError('INVALID_TRANSITION');
      const statusBefore = request.status;
      request.status = unwrap(
        owner
          ? transition(request.status, 'CANCEL', { actor: 'BUYER_OWNER', reason })
          : transition(request.status, 'ADMIN_CANCEL', { actor: 'ADMIN', reason }),
      );
      request.cancelReason = reason || null;
      if (!owner)
        this.audit(
          em,
          actor,
          'rfq.cancel',
          'rfq',
          request.id,
          { status: statusBefore },
          { status: request.status, reason },
        );
      for (const quotation of await em.find(CooperativeQuotationEntity, {
        request,
        status: 'SUBMITTED',
      }))
        quotation.status = 'WITHDRAWN';
      // A payment still waiting for money on a cancelled order is cancelled with it (ADR-0021).
      for (const payment of await em.find(Payment, { order: request, status: 'PENDING' })) {
        payment.status = unwrap(
          paymentTransition('PENDING', 'CANCEL', { actor: owner ? 'BUYER_OWNER' : 'ADMIN' }),
        );
      }
      const accepted = await em.findOne(CooperativeQuotationEntity, {
        request,
        status: 'ACCEPTED',
      });
      const householdIds = [...request.invitedHouseholdIds];
      if (accepted) {
        const allocations = await em.find(OrderAllocationEntity, { quotation: accepted });
        for (const allocation of allocations) {
          householdIds.push(allocation.household.id);
          // DONE has no exit: finished shares stay DONE when the order is cancelled.
          if (
            allocation.status !== 'DECLINED' &&
            allocation.status !== 'CANCELLED' &&
            allocation.status !== 'DONE'
          ) {
            allocation.status = unwrap(allocationTransition(allocation.status, 'CANCEL', {}));
          }
        }
      }
      // Nobody else has seen a draft, so cancelling one notifies nobody.
      if (statusBefore !== 'DRAFT')
        await this.notifier.notify(em, {
          kind: 'ORDER_CANCELLED',
          requestId: request.id,
          quotationId: accepted?.id,
          actorId: actor.id,
          recipientIds: [
            request.buyer.id,
            request.coordinatorId,
            ...(await this.notifier.representativeIds(em, [...new Set(householdIds)])),
          ],
        });
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  /**
   * GH#11: buyer chủ hoặc admin xác nhận đã nhận hàng. Chỉ khi mọi
   * allocation DONE (guard T5 allAllocationsDone).
   */
  async confirmReceipt(actor: Actor, requestId: string, version: number) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      const owner = this.isOwner(actor, request);
      const admin = actor.role === 'ADMIN';
      if (!owner && !admin) throw notFound();
      if (actor.locked) throw forbidden();
      assertVersion(request, version);
      if (!owner && request.coordinationOptIn) this.coordinator(actor, request);
      const accepted = await em.findOne(
        CooperativeQuotationEntity,
        { request, status: 'ACCEPTED' },
        { populate: ['request'] },
      );
      // Nothing accepted yet means the request is not in production: an invalid transition (GH#244).
      if (!accepted) throw new AppError('INVALID_TRANSITION');
      const allocations = await em.find(
        OrderAllocationEntity,
        { quotation: accepted },
        { populate: ['household'] },
      );
      // Nobody coordinates a direct order, so the board only steps in once a reallocation split it.
      if (!owner && !request.coordinationOptIn && !this.isSplit(allocations)) throw notFound();
      const statusBefore = request.status;
      request.status = unwrap(
        transition(request.status, 'CONFIRM_DELIVERY', {
          actor: owner ? 'BUYER_OWNER' : 'ADMIN',
          allocationStatuses: liveShares(allocations).map((allocation) => allocation.status),
        }),
      );
      if (admin)
        this.audit(
          em,
          actor,
          'rfq.confirm_receipt',
          'rfq',
          request.id,
          { status: statusBefore },
          {
            status: request.status,
          },
        );
      await this.notifier.notify(em, {
        kind: 'ORDER_RECEIVED',
        requestId: request.id,
        quotationId: accepted.id,
        actorId: actor.id,
        // The buyer is told too when the administrator confirms on their behalf (the actor is never notified).
        recipientIds: [
          request.coordinatorId,
          request.buyer.id,
          ...(await this.notifier.representativeIds(
            em,
            allocations.map((allocation) => allocation.household.id),
          )),
        ],
      });
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  /**
   * FR-ORD-11, BR-05 (GH#248 s5-11): after delivery the owning buyer rates each household that did work on
   * the order, 1 to 5 stars and an optional comment. One rating per (request, household): rating again edits
   * it, for `RATING_EDIT_WINDOW_DAYS` after it was first given. The request is locked first so two saves of
   * the same pair cannot both insert.
   */
  async rateHousehold(
    actor: Actor,
    requestId: string,
    householdId: string,
    input: RateHouseholdRequest,
  ): Promise<HouseholdRatingDto> {
    if (actor.locked) throw forbidden();
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (!this.isOwner(actor, request)) throw notFound();
      if (request.status !== 'DELIVERED')
        throw new AppError('INVALID_TRANSITION', 'ratings open once the request is delivered');
      const accepted = await em.findOne(CooperativeQuotationEntity, {
        request,
        status: 'ACCEPTED',
      });
      // Only a household that finished a share of this order can be rated.
      const share = accepted
        ? await em.findOne(OrderAllocationEntity, {
            quotation: accepted,
            household: householdId,
            status: 'DONE',
          })
        : null;
      if (!share) throw notFound();
      const comment = input.comment ? input.comment : null;
      const existing = await em.findOne(HouseholdRating, { request, household: householdId });
      if (existing) {
        if (!isRatingEditable(existing.createdAt, new Date()))
          throw new AppError('BUSINESS_RULE_VIOLATED', 'RATING_WINDOW_CLOSED');
        existing.stars = input.stars;
        existing.comment = comment;
        await em.flush();
        return toRatingDto(existing);
      }
      const rating = em.create(HouseholdRating, {
        request,
        household: em.getReference(Household, householdId),
        raterId: actor.id,
        stars: input.stars,
        comment,
      });
      await em.flush();
      return toRatingDto(rating);
    });
  }

  /** GH#11: admin hoặc hộ đơn-1-hộ bắt đầu sản xuất. Mọi allocation phải CONFIRMED (T4). */
  async startProduction(actor: Actor, requestId: string, version: number) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (actor.locked) throw forbidden();
      assertVersion(request, version);
      if (actor.role === 'ADMIN' && request.coordinationOptIn) this.coordinator(actor, request);
      const accepted = await em.findOneOrFail(
        CooperativeQuotationEntity,
        { request, status: 'ACCEPTED' },
        { populate: ['request'] },
      );
      const allocations = await em.find(
        OrderAllocationEntity,
        { quotation: accepted },
        { populate: ['household'] },
      );
      const households = new Set(
        liveShares(allocations).map((allocation) => allocation.household.id),
      );
      let householdId: string | undefined;
      // Nobody coordinates a direct order, so the board only steps in once a reallocation split it.
      if (actor.role === 'ADMIN' && !request.coordinationOptIn && households.size < 2)
        throw notFound();
      if (actor.role === 'HOUSEHOLD') {
        householdId = (await this.ownHousehold(em, actor, false)).id;
      } else if (actor.role !== 'ADMIN') throw notFound();
      const statusBefore = request.status;
      // ADR-0021: where online payment is on, production waits for a paid deposit.
      const depositRequired = paymentsConfig().depositRequired;
      const depositPaid =
        depositRequired &&
        (await em.count(Payment, { order: request, kind: 'DEPOSIT', status: 'PAID' })) > 0;
      request.status = unwrap(
        transition(request.status, 'START_PRODUCTION', {
          depositRequired,
          depositPaid,
          actor: actor.role === 'ADMIN' ? 'ADMIN' : 'ARTISAN',
          allocationStatuses: liveShares(allocations).map((allocation) => allocation.status),
          householdCount: households.size,
          actorOwnsSoleAllocation:
            actor.role === 'ADMIN'
              ? undefined
              : households.size === 1 && households.has(householdId as string),
        }),
      );
      if (actor.role === 'ADMIN')
        this.audit(
          em,
          actor,
          'rfq.start_production',
          'rfq',
          request.id,
          { status: statusBefore },
          {
            status: request.status,
          },
        );
      for (const allocation of allocations) {
        if (allocation.status === 'CONFIRMED') {
          allocation.status = unwrap(allocationTransition(allocation.status, 'START', {}));
        }
      }
      await this.notifier.notify(em, {
        kind: 'PRODUCTION_STARTED',
        requestId: request.id,
        quotationId: accepted.id,
        actorId: actor.id,
        recipientIds: [
          request.buyer.id,
          ...(await this.notifier.representativeIds(em, [...households])),
        ],
      });
      request.revision++;
      await em.flush();
      return toRfqResponse(request);
    });
  }

  /** Coordination queue (FR-ORD-01, 02): open opted-in requests, then the orders being coordinated. */
  async coordinationQueue(actor: Actor): Promise<CoordinationQueueItemDto[]> {
    const em = this.orm.em.fork();
    const requests = await em.find(
      QuotationRequest,
      {
        coordinationOptIn: true,
        $or: [
          { status: { $in: ['SENT', 'BIDDING'] }, biddingClosesAt: { $gt: new Date() } },
          { status: { $in: ['ACCEPTED', 'IN_PRODUCTION'] } },
          // A delivered request made for a customer stays listed while its rating window is open (FR-ORD-11).
          {
            status: 'DELIVERED',
            onBehalfName: { $ne: null },
            updatedAt: { $gt: new Date(Date.now() - RATING_EDIT_WINDOW_DAYS * 86_400_000) },
          },
        ],
      },
      { populate: ['buyer'], orderBy: { biddingClosesAt: 'asc' }, limit: 200 },
    );
    const offers = await em.find(ContributionOfferEntity, {
      request: { $in: requests.map((request) => request.id) },
      status: 'ACTIVE',
    });
    const counts = new Map<string, number>();
    for (const offer of offers)
      counts.set(offer.request.id, (counts.get(offer.request.id) ?? 0) + 1);
    const coordinatorIds = requests.flatMap((request) => request.coordinatorId ?? []);
    const coordinators = await em.find(AppUser, { id: { $in: [...new Set(coordinatorIds)] } });
    const names = new Map(coordinators.map((user) => [user.id, user.fullName ?? user.email]));
    return requests.map((request) => ({
      id: request.id,
      version: request.version,
      status: request.status,
      design: request.design,
      quantity: request.quantity,
      unit: request.unit,
      requiredBy: request.requiredBy.toISOString(),
      biddingClosesAt: request.biddingClosesAt.toISOString(),
      buyerName: request.onBehalfName ?? request.buyer.fullName ?? request.buyer.email,
      onBehalfOf: onBehalfOf(request),
      contributionCount: counts.get(request.id) ?? 0,
      coordinatorName: request.coordinatorId ? (names.get(request.coordinatorId) ?? null) : null,
      claimed: Boolean(request.coordinatorId),
      claimedByMe: request.coordinatorId === actor.id,
    }));
  }

  private audit(
    em: EntityManager,
    actor: Actor,
    action: AuditAction,
    entity: string,
    entityId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) {
    em.create(AuditLog, { actorId: actor.id, action, entity, entityId, before, after });
  }

  private async allocation(em: EntityManager, id: string) {
    const allocation = await em.findOne(OrderAllocationEntity, id, {
      populate: ['quotation.request', 'household'],
    });
    if (!allocation) throw notFound();
    return allocation;
  }

  private acceptedOnly(request: QuotationRequest) {
    if (request.status !== 'ACCEPTED') throw new AppError('INVALID_TRANSITION');
  }

  private async request(em: EntityManager, id: string, lock = false) {
    const request = await em.findOne(
      QuotationRequest,
      id,
      lock ? { lockMode: LockMode.PESSIMISTIC_WRITE } : {},
    );
    if (!request) throw notFound();
    return request;
  }

  private open(request: QuotationRequest) {
    if (
      (request.status !== 'SENT' && request.status !== 'BIDDING') ||
      Date.now() >= request.biddingClosesAt.getTime()
    ) {
      throw new AppError('RFQ_BIDDING_CLOSED');
    }
  }

  /** FR-ORD-11: the owner sees their own ratings next to the delivered order, never anyone else's. */
  private async addOwnRatings(
    em: EntityManager,
    actor: Actor,
    request: QuotationRequest,
    response: RfqResponse,
  ) {
    if (request.status !== 'DELIVERED' || !this.isOwner(actor, request)) return;
    response.ratings = (
      await em.find(HouseholdRating, { request }, { orderBy: { createdAt: 'asc' } })
    ).map(toRatingDto);
  }

  /**
   * The buyer of the request: the buyer who made it, or the administrator who made it for an off-platform
   * customer (FR-ORD-10), who then does the buyer's accept, receive and rate steps.
   */
  private isOwner(actor: Actor, request: QuotationRequest): boolean {
    if (request.buyer.id !== actor.id) return false;
    return actor.role === 'BUYER' || (actor.role === 'ADMIN' && Boolean(request.onBehalfName));
  }

  /** More than one household holds a live share, i.e. a reallocation split the order. */
  private isSplit(allocations: readonly OrderAllocationEntity[]): boolean {
    return new Set(liveShares(allocations).map((a) => a.household.id)).size > 1;
  }

  private coordinator(actor: Actor, request: QuotationRequest) {
    assertCoordinator(actor, request);
  }

  /** The coordinator of a coordinated request; any admin for a request nobody coordinates (T7 names "Admin"). */
  private coordinatorOrBoard(actor: Actor, request: QuotationRequest) {
    assertCoordinatorOrBoard(actor, request);
  }

  private async ownHousehold(em: EntityManager, actor: Actor, writing = true) {
    if (writing && actor.locked) throw new AppError('HOUSEHOLD_ACCOUNT_LOCKED');
    const household = await em.findOne(Household, { representative: actor.id });
    if (!household) throw notFound();
    return household;
  }

  private async canRead(em: EntityManager, actor: Actor, request: QuotationRequest) {
    if (this.isOwner(actor, request)) return;
    if (
      actor.role === 'ADMIN' &&
      request.coordinationOptIn &&
      request.status !== 'DRAFT' &&
      (!request.coordinatorId || request.coordinatorId === actor.id)
    )
      return;
    if (actor.role === 'HOUSEHOLD' && request.status !== 'DRAFT') {
      const household = await this.ownHousehold(em, actor, false);
      if (request.invitedHouseholdIds.includes(household.id)) return;
    }
    throw notFound();
  }

  /** The files attached to a request, in the order the buyer attached them. */
  private async attachmentsOf(em: EntityManager, requestId: string): Promise<RfqAttachmentDto[]> {
    const links = await em.find(
      MediaLink,
      { targetType: 'RFQ', targetId: requestId, role: 'DOCUMENT' },
      { populate: ['media'], orderBy: { position: 'asc' } },
    );
    return links.map((link) => ({
      id: link.media.id,
      mimeType: link.media.mimeType,
      sizeBytes: link.media.sizeBytes,
    }));
  }

  /** Replaces the attachments of a draft with the buyer's own request attachments (FR-RFQ-01). */
  private async setAttachments(
    em: EntityManager,
    actor: Actor,
    request: QuotationRequest,
    mediaIds: readonly string[],
  ) {
    const current = await em.find(
      MediaLink,
      { targetType: 'RFQ', targetId: request.id, role: 'DOCUMENT' },
      { orderBy: { position: 'asc' } },
    );
    if (
      current.length === mediaIds.length &&
      current.every((link, index) => link.media.id === mediaIds[index])
    )
      return;
    const assets = mediaIds.length
      ? await em.find(MediaAsset, {
          id: { $in: [...mediaIds] },
          ownerId: actor.id,
          purpose: 'RFQ_ATTACHMENT',
          status: 'READY',
        })
      : [];
    if (assets.length !== mediaIds.length)
      throw new AppError('VALIDATION_FAILED', 'attachments are not available');
    for (const link of current) em.remove(link);
    // The unique (target, role, position) key forbids inserting before the old rows are gone.
    await em.flush();
    mediaIds.forEach((id, position) => {
      const asset = assets.find((candidate) => candidate.id === id) as MediaAsset;
      em.create(MediaLink, {
        media: asset,
        targetType: 'RFQ',
        targetId: request.id,
        role: 'DOCUMENT',
        position,
      });
    });
    await em.flush();
  }

  /**
   * BR-05: approved households with an unlocked representative that work in the request's category,
   * best fit first, capped. Capacity comes from the household's declared capacity and its published
   * products in the category; the buyers' ratings break ties (FR-ORD-11). Response rates do not exist in the model.
   */
  private async matchHouseholds(em: EntityManager, request: QuotationRequest): Promise<string[]> {
    const category = request.category;
    if (!category) return [];
    const households = await em.find(Household, {
      status: 'APPROVED',
      representative: { status: { $ne: 'LOCKED' } },
    });
    if (households.length === 0) return [];
    const products = await em.find(
      Product,
      { status: 'PUBLISHED', category, household: { $in: households.map((h) => h.id) } },
      { fields: ['household'] },
    );
    const published = new Map<string, number>();
    for (const product of products)
      published.set(product.household.id, (published.get(product.household.id) ?? 0) + 1);
    const ratings = await ratingSummaries(
      em,
      households.map((household) => household.id),
    );
    return selectMatchingHouseholds(
      households.map((household) => ({
        householdId: household.id,
        declaredCapacity: household.capacityByCategory?.[category],
        publishedProducts: published.get(household.id) ?? 0,
        ratingAverage: ratings.get(household.id)?.average ?? null,
      })),
    );
  }

  /** The invited household's active (SUBMITTED) direct quotation on the request, if any. */
  private activeDirectQuotation(em: EntityManager, request: QuotationRequest, householdId: string) {
    return em
      .find(CooperativeQuotationEntity, { request, bidType: 'INDIVIDUAL', status: 'SUBMITTED' })
      .then((rows) => rows.find((row) => ownsDirectQuotation(row, householdId)) ?? null);
  }

  /** The household checks an invited, non-coordinated request before it quotes. */
  private async directQuotingHousehold(
    em: EntityManager,
    actor: Actor,
    request: QuotationRequest,
    writing = true,
  ) {
    const household = await this.ownHousehold(em, actor, writing);
    if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
    if (request.coordinationOptIn) throw new AppError('RFQ_DIRECT_QUOTATION_NOT_ALLOWED');
    return household;
  }

  /** Published products of a household per craft category. */
  private async publishedByCategory(em: EntityManager, householdId: string) {
    const products = await em.find(
      Product,
      { status: 'PUBLISHED', household: householdId },
      { fields: ['category'] },
    );
    const counts = new Map<ProductCategory, number>();
    for (const product of products)
      counts.set(product.category, (counts.get(product.category) ?? 0) + 1);
    return counts;
  }

  private async checkHouseholds(em: EntityManager, ids: readonly string[]) {
    await assertEligibleHouseholds(em, ids);
  }

  private completion(iso: string, request: QuotationRequest) {
    if (!isCompletionDateValid(new Date(iso), request.biddingClosesAt, request.requiredBy)) {
      throw new AppError(
        'VALIDATION_FAILED',
        'completionDate must be after the quotation deadline and on or before delivery',
      );
    }
  }
}

/** A direct quotation has exactly one part: the household that made it. */
function ownsDirectQuotation(quotation: CooperativeQuotationEntity, householdId: string): boolean {
  return quotation.bidType === 'INDIVIDUAL' && quotation.parts[0]?.householdId === householdId;
}

function householdNames(households: readonly Household[]): Map<string, string> {
  return new Map(households.map((household) => [household.id, household.name]));
}

function requestFields(input: Omit<CreateRfqRequest, 'onBehalfOf'>) {
  return {
    customRequirements: input.customRequirements || null,
    title: input.title ?? null,
    category: input.category ?? null,
    budgetMinVnd: input.budgetMinVnd ?? null,
    budgetMaxVnd: input.budgetMaxVnd ?? null,
    design: input.design,
    quantity: input.quantity,
    unit: input.unit,
    destination: input.destination,
    requiredBy: new Date(input.requiredBy),
    biddingClosesAt: new Date(input.biddingClosesAt),
    invitedHouseholdIds: [...new Set(input.invitedHouseholdIds)],
    coordinationOptIn: input.coordinationOptIn,
  };
}

function decodeRequestCursor(raw: string): { t: string; id: string } {
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      typeof value.t === 'string' &&
      typeof value.id === 'string' &&
      !Number.isNaN(Date.parse(value.t))
    )
      return { t: value.t, id: value.id };
  } catch {
    // Falls through to the error below.
  }
  throw new AppError('VALIDATION_MALFORMED_REQUEST', 'cursor is not valid');
}

/**
 * T8 (GH#244): a request nobody quoted expires at its bidding deadline; one with quotations stays open for the
 * buyer's 7-day accept window after it, the same bound the T3 guard uses.
 */
function requestExpired(request: QuotationRequest): boolean {
  const now = new Date();
  if (request.status === 'SENT') return now.getTime() >= request.biddingClosesAt.getTime();
  if (request.status === 'BIDDING') return hasAcceptWindowElapsed(now, request.biddingClosesAt);
  return false;
}

function quotationStatus(quotation: CooperativeQuotationEntity) {
  return quotation.status === 'SUBMITTED' && requestExpired(quotation.request)
    ? 'LAPSED'
    : quotation.status;
}

function toRfqResponse(
  request: QuotationRequest,
  attachments?: readonly RfqAttachmentDto[],
): RfqResponse {
  return {
    id: request.id,
    version: request.version,
    revision: request.revision,
    status: requestExpired(request) ? 'EXPIRED' : request.status,
    title: request.title ?? request.design,
    category: request.category ?? null,
    budgetMinVnd: request.budgetMinVnd ?? null,
    budgetMaxVnd: request.budgetMaxVnd ?? null,
    cancelReason: request.cancelReason ?? null,
    createdAt: request.createdAt.toISOString(),
    design: request.design,
    quantity: request.quantity,
    unit: request.unit,
    destination: request.destination,
    requiredBy: request.requiredBy.toISOString(),
    biddingClosesAt: request.biddingClosesAt.toISOString(),
    invitedHouseholdIds: request.invitedHouseholdIds,
    coordinationOptIn: request.coordinationOptIn,
    customRequirements: request.customRequirements ?? null,
    ...(attachments ? { attachments: [...attachments] } : {}),
  };
}

/** The customer of a request an administrator made for them; null on a buyer's own request. */
function onBehalfOf(request: QuotationRequest): RfqResponse['onBehalfOf'] {
  return request.onBehalfName && request.onBehalfPhone
    ? {
        name: request.onBehalfName,
        phone: request.onBehalfPhone,
        ...(request.onBehalfEmail ? { email: request.onBehalfEmail } : {}),
      }
    : null;
}

/** Adds the off-platform customer for an administrator; buyers and households never receive it (FR-ORD-10). */
function withCustomer(response: RfqResponse, request: QuotationRequest, actor: Actor): RfqResponse {
  if (actor.role === 'ADMIN') response.onBehalfOf = onBehalfOf(request);
  return response;
}

function toRatingDto(rating: HouseholdRating): HouseholdRatingDto {
  return {
    householdId: rating.household.id,
    stars: rating.stars,
    comment: rating.comment ?? null,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
    editableUntil: ratingEditableUntil(rating.createdAt).toISOString(),
  };
}

/**
 * GH#445: a direct quotation whose stored part is missing (legacy row, or one hand-corrected in the JSON
 * column) has no unit price or completion date. The response states `null` for those two rather than the
 * invalid `0` / `''` sentinels that the strict contract rejects and that would break the whole list read.
 */
function toDirectQuotationDto(quotation: CooperativeQuotationEntity): DirectQuotationDto {
  const part = quotation.parts[0];
  return {
    id: quotation.id,
    version: quotation.version,
    status: quotationStatus(quotation),
    quantity: quotation.quantity,
    unitPriceVnd: part?.unitPriceVnd ?? null,
    totalVnd: quotation.totalVnd,
    completionDate: part?.completionDate ?? null,
    note: quotation.note ?? null,
  };
}

function toContributionDto(offer: ContributionOfferEntity): ContributionDto {
  return {
    id: offer.id,
    version: offer.version,
    householdId: offer.household.id,
    maxQuantity: offer.maxQuantity,
    unitPriceVnd: offer.unitPriceVnd,
    completionDate: offer.completionDate.toISOString(),
    status: offer.status,
  };
}

function toInternalQuotationDto(
  quotation: CooperativeQuotationEntity,
  names: ReadonlyMap<string, string>,
) {
  return {
    id: quotation.id,
    version: quotation.version,
    status: quotationStatus(quotation),
    bidType: quotation.bidType,
    note: quotation.note ?? null,
    quantity: quotation.quantity,
    parts: quotation.parts.map((part) => ({
      ...part,
      householdName: names.get(part.householdId) ?? part.householdId,
    })),
    productionTotalVnd: quotation.productionTotalVnd,
    additionalChargeVnd: quotation.additionalChargeVnd,
    totalVnd: quotation.totalVnd,
    deliveryTerms: quotation.deliveryTerms,
  };
}

function toBuyerQuotationDto(
  quotation: CooperativeQuotationEntity,
  names: ReadonlyMap<string, string>,
): BuyerQuotationDto {
  const projected = projectBuyerQuotation({
    quantity: quotation.quantity,
    parts: quotation.parts.map((part) => ({
      ...part,
      completionDate: new Date(part.completionDate),
    })),
    productionTotalVnd: quotation.productionTotalVnd,
    additionalChargeVnd: quotation.additionalChargeVnd,
    totalVnd: quotation.totalVnd,
    deliveryTerms: quotation.deliveryTerms,
  });
  return {
    id: quotation.id,
    version: quotation.version,
    status: quotationStatus(quotation),
    bidType: quotation.bidType,
    note: quotation.note ?? null,
    ...projected,
    parts: projected.parts.map((part, index) => ({
      ...part,
      householdName: names.get(part.householdId) ?? part.householdId,
      completionDate: part.completionDate.toISOString(),
      // The household bid to the buyer itself, so the buyer compares its price; cooperative rates stay private.
      ...(quotation.bidType === 'INDIVIDUAL' && quotation.parts[index]
        ? { unitPriceVnd: quotation.parts[index].unitPriceVnd }
        : {}),
    })),
  };
}

function toAllocationDto(allocation: OrderAllocationEntity): AllocationDto {
  return {
    id: allocation.id,
    version: allocation.version,
    householdId: allocation.household.id,
    ...allocationTimeline(allocation),
    quantity: allocation.quantity,
    completedQty: allocation.completedQty,
    status: allocation.status,
    progressLog: allocation.progressLog ?? [],
  };
}
