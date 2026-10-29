import { type EntityManager, LockMode, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  BuyerQuotationDto,
  ContributionDto,
  CreateContributionRequest,
  CreateCooperativeQuotationRequest,
  CreateRfqRequest,
  RfqResponse,
} from '@vcraft/contracts';
import {
  AppUser,
  ContributionOffer as ContributionOfferEntity,
  CooperativeQuotation as CooperativeQuotationEntity,
  Household,
  OutboxEvent,
  QuotationNotice,
  QuotationRequest,
} from '@vcraft/database';
import {
  assembleCooperativeQuotation,
  isCompletionDateValid,
  projectBuyerQuotation,
  transition,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';

/** All plan/input writes lock the request first, so changes cannot race with composition. */
@Injectable()
export class RfqService {
  constructor(private readonly orm: MikroORM) {}

  async createRequest(actor: Actor, input: CreateRfqRequest): Promise<RfqResponse> {
    if (actor.locked) throw forbidden();
    return this.orm.em.fork().transactional(async (em) => {
      await this.checkHouseholds(em, input.invitedHouseholdIds);
      const request = em.create(QuotationRequest, {
        buyer: em.getReference(AppUser, actor.id),
        design: input.design,
        quantity: input.quantity,
        unit: input.unit,
        destination: input.destination,
        requiredBy: new Date(input.requiredBy),
        biddingClosesAt: new Date(input.biddingClosesAt),
        invitedHouseholdIds: [...new Set(input.invitedHouseholdIds)],
        coordinationOptIn: input.coordinationOptIn,
      });
      await em.flush();
      return toRfqResponse(request);
    });
  }

  async getRequest(actor: Actor, id: string): Promise<RfqResponse> {
    const em = this.orm.em.fork();
    const request = await this.request(em, id);
    await this.canRead(em, actor, request);
    const response = toRfqResponse(request);
    if (actor.role === 'HOUSEHOLD') {
      const household = await this.ownHousehold(em, actor, false);
      response.invitedHouseholdIds = [household.id];
    }
    return response;
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
      request.coordinatorId = actor.id;
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
      request.invitedHouseholdIds = [...new Set([...request.invitedHouseholdIds, ...householdIds])];
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
      const offer = em.create(ContributionOfferEntity, {
        request,
        household,
        maxQuantity: input.maxQuantity,
        unitPriceVnd: input.unitPriceVnd,
        completionDate: new Date(input.completionDate),
      });
      request.revision++;
      await em.flush();
      return toContributionDto(offer);
    });
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
        for (const recipientId of new Set(
          [request.buyer.id, request.coordinatorId].filter((id): id is string => Boolean(id)),
        )) {
          em.create(QuotationNotice, {
            recipientId,
            requestId: request.id,
            quotationId: quotation.id,
          });
        }
        em.create(OutboxEvent, {
          type: 'quotation.withdrawn',
          payload: {
            requestId: request.id,
            quotationId: quotation.id,
            recipientIds: [request.buyer.id, request.coordinatorId].filter(Boolean),
          },
        });
      }
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

  async listNotices(actor: Actor) {
    const notices = await this.orm.em.fork().find(
      QuotationNotice,
      { recipientId: actor.id },
      {
        orderBy: { createdAt: 'desc' },
        limit: 100,
      },
    );
    return notices.map((notice) => ({
      id: notice.id,
      version: notice.version,
      kind: notice.kind,
      requestId: notice.requestId,
      quotationId: notice.quotationId,
      createdAt: notice.createdAt.toISOString(),
    }));
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
