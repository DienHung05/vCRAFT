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
  CreateRfqRequest,
  ListRfqsQuery,
  MyAllocationDto,
  MyInvitationDto,
  PriceHintDto,
  ReportProgressRequest,
  RfqListDto,
  RfqResponse,
} from '@vcraft/contracts';
import {
  AppUser,
  AuditLog,
  ContributionOffer as ContributionOfferEntity,
  CooperativeQuotation as CooperativeQuotationEntity,
  Household,
  OrderAllocation as OrderAllocationEntity,
  OutboxEvent,
  Product,
  QuotationRequest,
} from '@vcraft/database';
import {
  allocationTransition,
  assembleCooperativeQuotation,
  checkProgressReport,
  isCompletionDateValid,
  projectBuyerQuotation,
  suggestPriceRange,
  transition,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { ConsentService } from '../../privacy/application/consent.service';
import { QuotationNotifier } from './quotation-notifier';

/** All plan/input writes lock the request first, so changes cannot race with composition. */
@Injectable()
export class RfqService {
  constructor(
    private readonly orm: MikroORM,
    private readonly notifier: QuotationNotifier,
    private readonly media: MediaService,
    private readonly consents: ConsentService,
  ) {}

  async createRequest(actor: Actor, input: CreateRfqRequest): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    // The request carries a delivery address, so it is only stored after the buyer consented (NFR-SEC-07).
    await this.consents.require(actor.id, 'RFQ_CONTACT');
    return this.orm.em.fork().transactional(async (em) => {
      await this.checkHouseholds(em, input.invitedHouseholdIds);
      const request = em.create(QuotationRequest, {
        buyer: em.getReference(AppUser, actor.id),
        ...requestFields(input),
      });
      await em.flush();
      return toRfqResponse(request);
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
      return toRfqResponse(request);
    });
  }

  async listRequests(actor: Actor, query: ListRfqsQuery): Promise<RfqListDto> {
    const em = this.orm.em.fork();
    const and: FilterQuery<QuotationRequest>[] = [{ buyer: actor.id }];
    const now = new Date();
    const open = ['SENT', 'BIDDING'] as const;
    if (query.status === 'EXPIRED')
      and.push({
        $or: [
          { status: 'EXPIRED' },
          { status: { $in: [...open] }, biddingClosesAt: { $lte: now } },
        ],
      });
    else if (query.status === 'SENT' || query.status === 'BIDDING')
      and.push({ status: query.status, biddingClosesAt: { $gt: now } });
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
    const response = toRfqResponse(request);
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
    // `invitedHouseholdIds` is a JSON column with no portable "contains" across both drivers.
    const requests = (
      await em.find(
        QuotationRequest,
        { status: { $ne: 'DRAFT' } },
        { orderBy: { biddingClosesAt: 'desc' }, limit: 1000 },
      )
    ).filter((request) => request.invitedHouseholdIds.includes(household.id));
    const offers = await em.find(
      ContributionOfferEntity,
      { household, request: { $in: requests.map((request) => request.id) } },
      { populate: ['household'] },
    );
    const byRequest = new Map(offers.map((offer) => [offer.request.id, offer]));
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
        return {
          request: { ...toRfqResponse(request), invitedHouseholdIds: [household.id] },
          contribution: offer ? toContributionDto(offer) : null,
          declined: (request.declinedHouseholdIds ?? []).includes(household.id),
        };
      });
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
      return toRfqResponse(request);
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
    return {
      request: toRfqResponse(request),
      contributions: offers.map((offer) => ({
        ...toContributionDto(offer),
        householdName: offer.household.name,
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
      if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
      if (household.status !== 'APPROVED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
      this.completion(input.completionDate, request);
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
      if (input) this.completion(input.completionDate, request);
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
      return toInternalQuotationDto(entity, offers);
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
    const offers = await em.find(ContributionOfferEntity, { request }, { populate: ['household'] });
    if (actor.role === 'ADMIN')
      return quotations.map((quotation) => toInternalQuotationDto(quotation, offers));
    return quotations.map((quotation) => toBuyerQuotationDto(quotation, offers));
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
      if (actor.role !== 'BUYER' || request.buyer.id !== actor.id) throw notFound();
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
      const offers = await em.find(
        ContributionOfferEntity,
        { request },
        { populate: ['household'] },
      );
      const names = new Map(offers.map((offer) => [offer.household.id, offer.household]));
      if (chosen.parts.length === 0)
        throw new AppError('BUSINESS_RULE_VIOLATED', 'ACCEPT_EMPTY_PLAN');
      for (const part of chosen.parts) {
        const household = names.get(part.householdId);
        if (!household) throw new AppError('BUSINESS_RULE_VIOLATED', 'ACCEPT_UNKNOWN_HOUSEHOLD');
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

  /** GH#11: đọc allocations của đơn đã chốt. Buyer chủ, admin điều phối, hoặc hộ có phần. */
  async listAllocations(actor: Actor, requestId: string): Promise<AllocationDto[]> {
    const em = this.orm.em.fork();
    const request = await this.request(em, requestId);
    const accepted = await em.findOne(
      CooperativeQuotationEntity,
      { request, status: 'ACCEPTED' },
      { populate: ['request'] },
    );
    if (!accepted) throw notFound();
    if (actor.role === 'ADMIN') this.coordinator(actor, request);
    else if (actor.role === 'BUYER' && request.buyer.id === actor.id) {
      // Buyer chủ đọc toàn bộ allocations.
    } else if (actor.role === 'HOUSEHOLD') {
      const household = await this.ownHousehold(em, actor, false);
      if (!request.invitedHouseholdIds.includes(household.id)) throw notFound();
    } else throw notFound();
    const allocations = await em.find(
      OrderAllocationEntity,
      { quotation: accepted },
      { populate: ['household'], orderBy: { createdAt: 'asc' } },
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
      request.status = unwrap(
        transition(request.status, 'CANCEL', {
          actor: 'BUYER_OWNER',
          reason: 'household declined',
        }),
      );
      const siblings = await em.find(
        OrderAllocationEntity,
        { quotation: allocation.quotation, status: ['PROPOSED', 'CONFIRMED'] },
        { populate: ['household'] },
      );
      for (const sibling of siblings) {
        // Hàng của chính allocation vừa DECLINED còn PROPOSED trong CSDL nhưng đã DECLINED trong bộ nhớ.
        if (sibling.id === allocation.id) continue;
        sibling.status = unwrap(allocationTransition(sibling.status, 'CANCEL', {}));
      }
      await this.notifier.notify(em, {
        kind: 'ORDER_CANCELLED',
        requestId: request.id,
        quotationId: allocation.quotation.id,
        actorId: actor.id,
        recipientIds: [
          request.buyer.id,
          request.coordinatorId,
          ...(await this.notifier.representativeIds(em, [
            ...siblings.map((sibling) => sibling.household.id),
          ])),
        ],
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
  async cancelOrder(actor: Actor, requestId: string, version: number, reason: string) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (actor.locked) throw forbidden();
      const owner = actor.role === 'BUYER' && request.buyer.id === actor.id;
      if (!owner) this.coordinator(actor, request);
      assertVersion(request, version);
      if (requestExpired(request)) throw new AppError('INVALID_TRANSITION');
      const statusBefore = request.status;
      request.status = unwrap(
        owner
          ? transition(request.status, 'CANCEL', { actor: 'BUYER_OWNER', reason })
          : transition(request.status, 'ADMIN_CANCEL', { actor: 'ADMIN', reason }),
      );
      request.cancelReason = reason;
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
      const accepted = await em.findOne(CooperativeQuotationEntity, {
        request,
        status: 'ACCEPTED',
      });
      const householdIds = [...request.invitedHouseholdIds];
      if (accepted) {
        const allocations = await em.find(OrderAllocationEntity, { quotation: accepted });
        for (const allocation of allocations) {
          householdIds.push(allocation.household.id);
          if (allocation.status !== 'DECLINED' && allocation.status !== 'CANCELLED') {
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
      const owner = actor.role === 'BUYER' && request.buyer.id === actor.id;
      const admin = actor.role === 'ADMIN' && request.coordinationOptIn;
      if (!owner && !admin) throw notFound();
      if (actor.locked) throw forbidden();
      assertVersion(request, version);
      if (admin && request.coordinatorId !== actor.id) throw notFound();
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
      const statusBefore = request.status;
      request.status = unwrap(
        transition(request.status, 'CONFIRM_DELIVERY', {
          actor: owner ? 'BUYER_OWNER' : 'ADMIN',
          allocationStatuses: allocations.map((allocation) => allocation.status),
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
        recipientIds: [
          request.coordinatorId,
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

  /** GH#11: admin hoặc hộ đơn-1-hộ bắt đầu sản xuất. Mọi allocation phải CONFIRMED (T4). */
  async startProduction(actor: Actor, requestId: string, version: number) {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.request(em, requestId, true);
      if (actor.locked) throw forbidden();
      assertVersion(request, version);
      if (actor.role === 'ADMIN') this.coordinator(actor, request);
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
      const households = new Set(allocations.map((allocation) => allocation.household.id));
      let householdId: string | undefined;
      if (actor.role === 'HOUSEHOLD') {
        householdId = (await this.ownHousehold(em, actor, false)).id;
      } else if (actor.role !== 'ADMIN') throw notFound();
      const statusBefore = request.status;
      request.status = unwrap(
        transition(request.status, 'START_PRODUCTION', {
          actor: actor.role === 'ADMIN' ? 'ADMIN' : 'ARTISAN',
          allocationStatuses: allocations.map((allocation) => allocation.status),
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
      buyerName: request.buyer.fullName ?? request.buyer.email,
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

  private coordinator(actor: Actor, request: QuotationRequest) {
    if (actor.role !== 'ADMIN' || request.coordinatorId !== actor.id || !request.coordinationOptIn)
      throw notFound();
    if (actor.locked) throw forbidden();
  }

  private async ownHousehold(em: EntityManager, actor: Actor, writing = true) {
    if (writing && actor.locked) throw new AppError('HOUSEHOLD_ACCOUNT_LOCKED');
    const household = await em.findOne(Household, { representative: actor.id });
    if (!household) throw notFound();
    return household;
  }

  private async canRead(em: EntityManager, actor: Actor, request: QuotationRequest) {
    if (actor.role === 'BUYER' && request.buyer.id === actor.id) return;
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

  private async checkHouseholds(em: EntityManager, ids: readonly string[]) {
    const uniqueIds = [...new Set(ids)];
    const households = await em.find(
      Household,
      { id: { $in: uniqueIds } },
      { populate: ['representative'] },
    );
    if (
      households.length !== uniqueIds.length ||
      households.some((h) => h.status !== 'APPROVED' || h.representative.status === 'LOCKED')
    ) {
      throw new AppError('RFQ_ARTISAN_NOT_ELIGIBLE');
    }
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

function requestFields(input: CreateRfqRequest) {
  return {
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

function requestExpired(request: QuotationRequest): boolean {
  return (
    (request.status === 'SENT' || request.status === 'BIDDING') &&
    Date.now() >= request.biddingClosesAt.getTime()
  );
}

function quotationStatus(quotation: CooperativeQuotationEntity) {
  return quotation.status === 'SUBMITTED' && requestExpired(quotation.request)
    ? 'LAPSED'
    : quotation.status;
}

function toRfqResponse(request: QuotationRequest): RfqResponse {
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
  offers: readonly ContributionOfferEntity[],
) {
  const names = new Map(offers.map((offer) => [offer.household.id, offer.household.name]));
  return {
    id: quotation.id,
    version: quotation.version,
    status: quotationStatus(quotation),
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
  offers: readonly ContributionOfferEntity[],
): BuyerQuotationDto {
  const names = new Map(offers.map((offer) => [offer.household.id, offer.household.name]));
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
    ...projected,
    parts: projected.parts.map((part) => ({
      ...part,
      householdName: names.get(part.householdId) ?? part.householdId,
      completionDate: part.completionDate.toISOString(),
    })),
  };
}

function toAllocationDto(allocation: OrderAllocationEntity): AllocationDto {
  return {
    id: allocation.id,
    version: allocation.version,
    householdId: allocation.household.id,
    quantity: allocation.quantity,
    completedQty: allocation.completedQty,
    status: allocation.status,
    progressLog: allocation.progressLog ?? [],
  };
}
