import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { DataExportDto } from '@vcraft/contracts';
import {
  AppUser,
  Artisan,
  ConsentRecord,
  ContributionOffer,
  CooperativeQuotation,
  FIELD_CONTEXTS,
  FieldCipher,
  Household,
  JournalEntry,
  MediaLink,
  Notification,
  NotificationPreference,
  OrderAllocation,
  Product,
  QuotationNotice,
  QuotationRequest,
  Workshop,
} from '@vcraft/database';
import { PRIVACY_POLICY_VERSION } from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { toConsentDto } from './consent.service';

const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

/**
 * `GET /me/data-export` (NFR-SEC-07): everything the platform stores about the signed-in person, as
 * one JSON document. Each query is scoped to the caller's own id or household, so nothing of another
 * account can leak in; quotations are summarised without the other households' parts or prices.
 *
 * Values are exported in the clear. Encrypted columns (NFR-SEC-03: the citizen ID number) are decrypted
 * here, for the owner, before they go into the document; a new encrypted column must be added here too.
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
    private readonly cipher: FieldCipher,
  ) {}

  async export(actor: Actor): Promise<DataExportDto> {
    const em = this.orm.em.fork();
    const user = await em.findOne(AppUser, actor.id);
    if (!user || user.status === 'DELETED') throw notFound();

    const household = await em.findOne(Household, { representative: user });
    const requests = await em.find(
      QuotationRequest,
      { buyer: user },
      { orderBy: { createdAt: 'asc', id: 'asc' } },
    );
    const links = requests.length
      ? await em.find(
          MediaLink,
          { targetType: 'RFQ', targetId: { $in: requests.map((request) => request.id) } },
          { populate: ['media'], orderBy: { position: 'asc' } },
        )
      : [];
    const attachments = new Map<string, string[]>();
    for (const link of links)
      attachments.set(link.targetId, [...(attachments.get(link.targetId) ?? []), link.media.id]);
    const quotations = requests.length
      ? await em.find(CooperativeQuotation, { request: { $in: requests } })
      : [];

    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      policyVersion: PRIVACY_POLICY_VERSION,
      account: {
        id: user.id,
        email: user.email,
        username: user.username ?? null,
        fullName: user.fullName ?? null,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      household: household ? await this.household(em, household) : null,
      quotationRequests: requests.map((request) => ({
        id: request.id,
        status: request.status,
        title: request.title ?? null,
        category: request.category ?? null,
        design: request.design,
        quantity: request.quantity,
        unit: request.unit,
        destination: request.destination,
        customRequirements: request.customRequirements ?? null,
        attachmentIds: attachments.get(request.id) ?? [],
        budgetMinVnd: request.budgetMinVnd ?? null,
        budgetMaxVnd: request.budgetMaxVnd ?? null,
        requiredBy: iso(request.requiredBy),
        biddingClosesAt: iso(request.biddingClosesAt),
        coordinationOptIn: request.coordinationOptIn,
        cancelReason: request.cancelReason ?? null,
        createdAt: iso(request.createdAt),
        quotations: quotations
          .filter((quotation) => quotation.request.id === request.id)
          .map((quotation) => ({
            id: quotation.id,
            status: quotation.status,
            quantity: quotation.quantity,
            totalVnd: quotation.totalVnd,
            deliveryTerms: quotation.deliveryTerms,
            createdAt: iso(quotation.createdAt),
          })),
      })),
      contributions: household
        ? (await em.find(ContributionOffer, { household }, { orderBy: { createdAt: 'asc' } })).map(
            (offer) => ({
              id: offer.id,
              requestId: offer.request.id,
              status: offer.status,
              maxQuantity: offer.maxQuantity,
              unitPriceVnd: offer.unitPriceVnd,
              completionDate: iso(offer.completionDate),
              history: offer.history,
              createdAt: iso(offer.createdAt),
            }),
          )
        : [],
      directQuotations: household
        ? (
            await em.find(
              CooperativeQuotation,
              { bidType: 'INDIVIDUAL' },
              { populate: ['request'], orderBy: { createdAt: 'asc' } },
            )
          )
            .filter((quotation) => quotation.parts[0]?.householdId === household.id)
            .map((quotation) => ({
              id: quotation.id,
              requestId: quotation.request.id,
              status: quotation.status,
              quantity: quotation.quantity,
              unitPriceVnd: quotation.parts[0]?.unitPriceVnd ?? null,
              totalVnd: quotation.totalVnd,
              completionDate: quotation.parts[0]?.completionDate ?? null,
              note: quotation.note ?? null,
              createdAt: iso(quotation.createdAt),
            }))
        : [],
      allocations: household
        ? (await em.find(OrderAllocation, { household }, { orderBy: { createdAt: 'asc' } })).map(
            (allocation) => ({
              id: allocation.id,
              quotationId: allocation.quotation.id,
              status: allocation.status,
              quantity: allocation.quantity,
              completedQty: allocation.completedQty,
              progressLog: allocation.progressLog ?? [],
              createdAt: iso(allocation.createdAt),
            }),
          )
        : [],
      notifications: [
        ...(await em.find(Notification, { recipientId: user.id })).map((n) => ({
          id: n.id,
          type: n.type,
          subjectId: n.subjectId ?? null,
          readAt: iso(n.readAt),
          createdAt: iso(n.createdAt),
        })),
        ...(await em.find(QuotationNotice, { recipientId: user.id })).map((n) => ({
          id: n.id,
          type: n.kind,
          subjectId: n.requestId,
          readAt: iso(n.readAt),
          createdAt: iso(n.createdAt),
        })),
      ].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
      emailPreferences: (await em.find(NotificationPreference, { userId: user.id })).map((p) => ({
        type: p.type,
        emailEnabled: p.emailEnabled,
      })),
      consents: (
        await em.find(
          ConsentRecord,
          { userId: user.id },
          { orderBy: { createdAt: 'asc', id: 'asc' } },
        )
      ).map(toConsentDto),
      media: await this.media.exportOwned(user.id),
    };
  }

  private async household(em: EntityManager, household: Household) {
    const [workshops, artisans, products] = await Promise.all([
      em.find(Workshop, { household }, { orderBy: { createdAt: 'asc' } }),
      em.find(Artisan, { household }, { orderBy: { createdAt: 'asc' } }),
      em.find(Product, { household }, { orderBy: { createdAt: 'asc' } }),
    ]);
    const entries = products.length
      ? await em.find(
          JournalEntry,
          { product: { $in: products } },
          { orderBy: { seq: 'asc' }, populate: ['supersedes'] },
        )
      : [];
    return {
      profile: {
        id: household.id,
        name: household.name,
        slug: household.slug,
        status: household.status,
        statusReason: household.statusReason ?? null,
        // Decrypted for the owner, who is the only person this document goes to.
        idNumber: household.idNumberEnc
          ? this.cipher.decrypt(household.idNumberEnc, FIELD_CONTEXTS.householdIdNumber)
          : null,
        history: household.history,
        village: household.village ?? null,
        craft: household.craft ?? null,
        foundedYear: household.foundedYear ?? null,
        generations: household.generations ?? null,
        timeline: household.timeline ?? [],
        certifications: household.certifications ?? [],
        gallery: household.gallery ?? [],
        capacityByCategory: household.capacityByCategory ?? {},
        approvedAt: iso(household.approvedAt),
        createdAt: iso(household.createdAt),
      },
      workshops: workshops.map((w) => ({
        id: w.id,
        name: w.name,
        address: w.address,
        purpose: w.purpose,
        acceptsVisitors: w.acceptsVisitors,
        visitingInfo: w.visitingInfo ?? null,
        openingHours: w.openingHours ?? null,
        experienceDescription: w.experienceDescription ?? null,
        experienceDurationMinutes: w.experienceDurationMinutes ?? null,
        experiencePriceVnd: w.experiencePriceVnd ?? null,
        temporarilyClosed: w.temporarilyClosed,
        closureReason: w.closureReason ?? null,
        lat: w.lat ?? null,
        lng: w.lng ?? null,
      })),
      artisans: artisans.map((a) => ({
        id: a.id,
        name: a.name,
        craftRole: a.craftRole ?? null,
        bio: a.bio ?? null,
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        traceCode: p.traceCode,
        description: p.description,
        kind: p.kind,
        category: p.category,
        priceVnd: p.priceVnd,
        stock: p.stock,
        material: p.material ?? null,
        dimensions: p.dimensions ?? null,
        weightGrams: p.weightGrams ?? null,
        artisanNote: p.artisanNote ?? null,
        status: p.status,
        publishedAt: iso(p.publishedAt),
        createdAt: iso(p.createdAt),
        journal: entries
          .filter((entry) => entry.product.id === p.id)
          .map((entry) => ({
            seq: entry.seq,
            stage: entry.stage,
            declaredDate: entry.declaredDate,
            note: entry.note,
            images: entry.images,
            skipReason: entry.skipReason ?? null,
            supersedesSeq: entry.supersedes?.seq ?? null,
            recordedAt: iso(entry.createdAt),
            hash: entry.hash,
          })),
      })),
    };
  }
}
