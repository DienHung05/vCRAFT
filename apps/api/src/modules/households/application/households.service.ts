import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  AdminDashboardDto,
  AdminHouseholdDto,
  ApplyHouseholdRequest,
  CreateArtisanRequest,
  CreateProductRequest,
  CreateWorkshopRequest,
  HouseholdDocumentDto,
  HouseholdDto,
  MapPinsDto,
  ProductDto,
  ProductScanStatsDto,
  PublicHouseholdDto,
  RecordScanRequest,
  ResubmitHouseholdDto,
  RevealedIdNumberDto,
  SetIdNumberRequest,
  SetProductMakersRequest,
  TraceAvailabilityDto,
  UpdateHouseholdProfileRequest,
  UpdateProductRequest,
} from '@vcraft/contracts';
import {
  AppUser,
  Artisan,
  AuditLog,
  FIELD_CONTEXTS,
  FieldCipher,
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
  OutboxEvent,
  Product,
  ProductMaker,
  QuotationRequest,
  queueKnowledgeChange,
  resolveDbDriver,
  TraceScan,
  Workshop,
} from '@vcraft/database';
import {
  checkMakerCredits,
  type HouseholdEvent,
  type HouseholdStatus,
  householdNoticeKind,
  householdReviewState,
  householdTransition,
  isHouseholdPublic,
  maskIdNumber,
  type ProductEvent,
  productTransition,
  publicProductAvailability,
} from '@vcraft/domain';
import { slugify } from '@vcraft/utils';
import type { Actor } from '../../../common/auth/auth.guard';
import { deniedAccess } from '../../../common/auth/denied-access';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { NotificationPublisher } from '../../notifications/application/notification-publisher';
import { ConsentService } from '../../privacy/application/consent.service';
import { loadJournal } from '../../production-logs/application/journal.queries';
import {
  type HouseholdParts,
  productMediaIds,
  toArtisanDto,
  toHouseholdDto,
  toMapPinDto,
  toProductDto,
  toPublicHouseholdDto,
  toWorkshopDto,
} from '../households.mapper';
import {
  DAY_MS,
  last30VietnamDates,
  type ScanDayRow,
  vietnamDayStartUtc,
  zeroFilledTrend,
} from './dashboard-trend';
import { retireSlug, slugRetiredByOther } from './slug-redirects';
import { generateTraceCode } from './trace-code';

/** `<name>-<trace code>`: readable, and unique because the trace code is. */
function productSlug(name: string, traceCode: string): string {
  return `${slugify(name) || 'san-pham'}-${traceCode.toLowerCase()}`;
}

/**
 * Use case duyệt hộ và xuất bản (vCRAFT-9hg.3):
 * - Ban quản lý chấp nhận / từ chối / tạm ngừng / khôi phục hộ (khóa lạc quan + audit log).
 * - Tạm ngừng ẩn mọi thứ công khai nhưng hộ vẫn đọc đủ bản ghi riêng của mình.
 * - Rút một sản phẩm ẩn sản phẩm và nhật ký; QR hiện thông báo "không còn trưng bày".
 */
@Injectable()
export class HouseholdsService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
    private readonly notifications: NotificationPublisher,
    private readonly consents: ConsentService,
    private readonly cipher: FieldCipher,
  ) {}

  /** Database driver in use: `postgresql` or `mysql` (ADR-05); picks the GROUP BY date expression. */
  private get driver(): 'postgresql' | 'mysql' {
    return resolveDbDriver(process.env);
  }

  // --- Người đại diện hộ ---

  async apply(actor: Actor, input: ApplyHouseholdRequest): Promise<HouseholdDto> {
    if (actor.role !== 'ADMIN') await this.consents.require(actor.id, 'SIGN_UP');
    return this.orm.em.fork().transactional(async (em) => {
      if (actor.role === 'ADMIN') throw forbidden('administrators do not represent households');
      if (await em.findOne(Household, { representative: actor.id })) {
        throw new AppError('CONFLICT_DUPLICATE', 'this account already represents a household');
      }
      const user = await em.findOneOrFail(AppUser, actor.id);
      // Một vai trò cho mỗi tài khoản: tài khoản nộp hồ sơ trở thành tài khoản đại diện hộ
      user.role = 'HOUSEHOLD';
      const household = em.create(Household, {
        name: input.name,
        slug: input.slug,
        history: input.history,
        village: input.village ?? null,
        idNumberEnc: input.idNumber
          ? this.cipher.encrypt(input.idNumber, FIELD_CONTEXTS.householdIdNumber)
          : null,
        representative: user,
      });
      await em.flush();
      return toHouseholdDto(household, {
        artisans: [],
        workshops: [],
        products: [],
        makers: new Map(),
        idNumberMasked: input.idNumber ? maskIdNumber(input.idNumber) : null,
      });
    });
  }

  /** Bản ghi riêng: luôn đọc được kể cả khi hộ bị tạm ngừng hay từ chối. */
  async getMine(actor: Actor): Promise<HouseholdDto> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor);
    return toHouseholdDto(household, await this.parts(em, household, false));
  }

  /** Add or replace the representative's citizen ID number. Stored encrypted; the answer shows it masked. */
  async setIdNumber(actor: Actor, input: SetIdNumberRequest): Promise<HouseholdDto> {
    const em = this.orm.em.fork();
    const household = await this.ownWritableHousehold(em, actor);
    household.idNumberEnc = this.cipher.encrypt(input.idNumber, FIELD_CONTEXTS.householdIdNumber);
    await em.flush();
    return toHouseholdDto(household, await this.parts(em, household, false));
  }

  /**
   * Full citizen ID number for the review screen. Revealing it is an explicit, audited act: the audit entry
   * records who looked at which household, never the number itself.
   */
  async revealIdNumber(actor: Actor, householdId: string): Promise<RevealedIdNumberDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await em.findOne(Household, householdId);
      if (!household) throw notFound();
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'household.reveal_id_number',
        entity: 'household',
        entityId: household.id,
        before: null,
        after: null,
      });
      await em.flush();
      return {
        idNumber: household.idNumberEnc
          ? this.cipher.decrypt(household.idNumberEnc, FIELD_CONTEXTS.householdIdNumber)
          : null,
      };
    });
  }

  /** Chủ hộ sửa hồ sơ của chính mình; chứng nhận đã xác minh giữ nguyên dấu khi không đổi nội dung. */
  async updateProfile(
    actor: Actor,
    expectedVersion: number,
    input: UpdateHouseholdProfileRequest,
  ): Promise<HouseholdDto> {
    const updated = await this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      assertVersion(household, expectedVersion);
      if (input.gallery) {
        const ids = input.gallery.flatMap((item) => ('mediaId' in item ? [item.mediaId] : []));
        const owned = await this.media.ownedBy(actor.id, ids);
        if (ids.some((id) => !owned.has(id))) throw forbidden('gallery media is not yours');
        household.gallery = input.gallery.map((item) => ({ ...item }));
      }
      if (input.certifications) {
        const verified = new Set(
          (household.certifications ?? [])
            .filter((c) => c.verified)
            .map((c) => `${c.name}|${c.issuer}|${c.year}`),
        );
        household.certifications = input.certifications.map((c) => ({
          ...c,
          verified: verified.has(`${c.name}|${c.issuer}|${c.year}`),
        }));
      }
      if (input.slug !== undefined && input.slug !== household.slug) {
        const taken =
          (await em.count(Household, { slug: input.slug, id: { $ne: household.id } })) > 0 ||
          (await slugRetiredByOther(em, 'HOUSEHOLD', input.slug, household.id));
        if (taken) throw new AppError('CONFLICT_DUPLICATE', 'this slug is already in use');
        await retireSlug(em, 'HOUSEHOLD', household.id, household.slug, input.slug);
        household.slug = input.slug;
      }
      if (input.history !== undefined) household.history = input.history;
      if (input.craft !== undefined) household.craft = input.craft || null;
      if (input.village !== undefined) household.village = input.village || null;
      if (input.foundedYear !== undefined) household.foundedYear = input.foundedYear;
      if (input.generations !== undefined) household.generations = input.generations;
      if (input.timeline !== undefined) {
        const ids = input.timeline.flatMap((e) => (e.photo ? [e.photo.mediaId] : []));
        const owned = await this.media.ownedBy(actor.id, ids);
        if (ids.some((id) => !owned.has(id))) throw forbidden('timeline media is not yours');
        // Stable sort: within a year the household's own order is kept.
        household.timeline = [...input.timeline]
          .sort((a, b) => a.year - b.year)
          .map((e) => ({ year: e.year, title: e.title, text: e.text, photo: e.photo ?? null }));
      }
      if (input.capacityByCategory !== undefined) {
        household.capacityByCategory = input.capacityByCategory;
      }
      queueKnowledgeChange(em, 'HOUSEHOLD', household.id);
      await em.flush();
      return household.id;
    });
    const em = this.orm.em.fork();
    const household = await em.findOneOrFail(Household, updated);
    return toHouseholdDto(household, await this.parts(em, household, false));
  }

  /**
   * Explicit resubmission after the applicant answered an information request (vCRAFT-8my.2).
   * Optimistic concurrency: `assertVersion` rejects a write based on a stale read with 409
   * `STALE_VERSION`; because `decide` bumps the same version inside its own transaction, a resubmit
   * racing a board decision fails on flush instead of silently overwriting it. The active reason is
   * cleared here and kept as history in the audit log; the marker makes the queue show RESUBMITTED
   * until the board writes a new reason or decides.
   */
  async resubmit(actor: Actor, expectedVersion: number): Promise<ResubmitHouseholdDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      assertVersion(household, expectedVersion);
      if (household.status !== 'PENDING_REVIEW') {
        throw new AppError('INVALID_TRANSITION', 'only a pending application can be resubmitted');
      }
      // Only an open information request can be answered; this also blocks repeated submissions,
      // because a resubmit clears the active reason (the old text stays in the audit log).
      const activeReason = household.statusReason?.trim() ?? '';
      if (activeReason.length === 0) {
        throw new AppError('INVALID_TRANSITION', 'no information request to answer');
      }
      const now = new Date();
      household.statusReason = null;
      household.resubmittedAt = now;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'household.resubmit',
        entity: 'household',
        entityId: household.id,
        before: { status: household.status, reason: activeReason },
        after: { status: household.status, reason: null, resubmittedAt: now.toISOString() },
      });
      // An actionable signal for the board (FR-ADM-03): the application was answered and sent back.
      this.notifications.publish(em, {
        type: 'HOUSEHOLD_RESUBMITTED',
        subjectId: household.id,
        actorId: actor.id,
        recipientIds: (
          await em.find(AppUser, { role: 'ADMIN', status: 'ACTIVE' }, { fields: ['id'] })
        ).map((admin) => admin.id),
        email: false,
      });
      await em.flush();
      return {
        version: household.version,
        resubmittedAt: now.toISOString(),
        reviewState: householdReviewState(
          household.status,
          household.statusReason,
          household.resubmittedAt,
        ),
      };
    });
  }

  async updateWorkshop(
    actor: Actor,
    workshopId: string,
    expectedVersion: number,
    input: CreateWorkshopRequest,
  ) {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      const workshop = await em.findOne(Workshop, { id: workshopId, household });
      if (!workshop) throw notFound();
      assertVersion(workshop, expectedVersion);
      workshop.name = input.name;
      workshop.address = input.address;
      workshop.purpose = input.purpose;
      workshop.acceptsVisitors = input.acceptsVisitors;
      workshop.visitingInfo = input.visitingInfo ?? null;
      workshop.openingHours = input.openingHours ?? null;
      workshop.experienceDescription = input.experience?.description ?? null;
      workshop.experienceDurationMinutes = input.experience?.durationMinutes ?? null;
      workshop.experiencePriceVnd = input.experience?.priceVnd ?? null;
      workshop.temporarilyClosed = input.temporarilyClosed;
      workshop.closureReason = input.temporarilyClosed ? (input.closureReason ?? null) : null;
      // Left out keeps the stored hamlet, so a client that does not know the field cannot clear it (ADR-0023).
      if (input.areaCode !== undefined) workshop.areaCode = input.areaCode;
      workshop.lat = input.lat === undefined ? null : input.lat.toFixed(6);
      workshop.lng = input.lng === undefined ? null : input.lng.toFixed(6);
      await em.flush();
      return toWorkshopDto(workshop);
    });
  }

  async addWorkshop(actor: Actor, input: CreateWorkshopRequest) {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      const workshop = em.create(Workshop, {
        household,
        name: input.name,
        address: input.address,
        purpose: input.purpose,
        acceptsVisitors: input.acceptsVisitors,
        visitingInfo: input.visitingInfo ?? null,
        openingHours: input.openingHours ?? null,
        experienceDescription: input.experience?.description ?? null,
        experienceDurationMinutes: input.experience?.durationMinutes ?? null,
        experiencePriceVnd: input.experience?.priceVnd ?? null,
        temporarilyClosed: input.temporarilyClosed,
        closureReason: input.temporarilyClosed ? (input.closureReason ?? null) : null,
        areaCode: input.areaCode ?? null,
        lat: input.lat === undefined ? null : input.lat.toFixed(6),
        lng: input.lng === undefined ? null : input.lng.toFixed(6),
      });
      await em.flush();
      return toWorkshopDto(workshop);
    });
  }

  async addArtisan(actor: Actor, input: CreateArtisanRequest) {
    // A maker's name and role are published on the household page, so the household must have agreed.
    await this.consents.require(actor.id, 'MAKER_PROFILE');
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      const artisan = em.create(Artisan, {
        household,
        name: input.name,
        craftRole: input.craftRole ?? null,
        bio: input.bio ?? null,
      });
      await em.flush();
      return toArtisanDto(artisan);
    });
  }

  async createProduct(actor: Actor, input: CreateProductRequest): Promise<ProductDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownApprovedHousehold(em, actor);
      const traceCode = await this.uniqueTraceCode(em);
      const product = em.create(Product, {
        household,
        name: input.name,
        slug: productSlug(input.name, traceCode),
        traceCode,
        description: input.description,
        kind: input.kind,
        batchSize: input.batchSize ?? null,
        category: input.category,
        priceVnd: input.priceVnd,
        stock: input.stock,
        material: input.material ?? null,
        dimensions: input.dimensions ?? null,
        weightGrams: input.weightGrams ?? null,
        artisanNote: input.artisanNote ?? null,
      });
      await em.flush();
      return toProductDto(product);
    });
  }

  /** Chủ hộ sửa thông tin và ảnh sản phẩm; ảnh chỉ được gắn khi chính họ đã tải lên. */
  async updateProduct(
    actor: Actor,
    productId: string,
    expectedVersion: number,
    input: UpdateProductRequest,
  ): Promise<ProductDto> {
    const id = await this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      const product = await this.ownProduct(em, actor, household, productId);
      assertVersion(product, expectedVersion);
      if (input.images) {
        const ids = input.images.map((image) => image.mediaId);
        const owned = await this.media.ownedBy(actor.id, ids);
        if (ids.some((mediaId) => !owned.has(mediaId))) {
          throw forbidden('product media is not yours');
        }
        product.images = input.images;
        // Ảnh tải lên thay bìa có sẵn của dữ liệu mẫu.
        if (input.images.length > 0) {
          product.coverUrl = null;
          product.coverAlt = null;
          product.coverAltEn = null;
        }
      }
      if (input.name !== undefined && input.name !== product.name) {
        product.name = input.name;
        // The slug follows the name; the old one keeps answering with a redirect (PLAN E5).
        const slug = productSlug(input.name, product.traceCode);
        await retireSlug(em, 'PRODUCT', product.id, product.slug, slug);
        product.slug = slug;
      }
      if (input.description !== undefined) product.description = input.description;
      if (input.category !== undefined) product.category = input.category;
      if (input.priceVnd !== undefined) product.priceVnd = input.priceVnd;
      if (input.stock !== undefined) product.stock = input.stock;
      if (input.material !== undefined) product.material = input.material || null;
      if (input.dimensions !== undefined) product.dimensions = input.dimensions || null;
      if (input.weightGrams !== undefined) product.weightGrams = input.weightGrams;
      if (input.artisanNote !== undefined) product.artisanNote = input.artisanNote || null;
      queueKnowledgeChange(em, 'PRODUCT', product.id);
      await em.flush();
      return product.id;
    });
    const em = this.orm.em.fork();
    const product = await em.findOneOrFail(Product, id);
    return toProductDto(
      product,
      (await this.makersOf(em, [product])).get(product.id),
      await this.media.publicMedia(productMediaIds([product])),
    );
  }

  /** Xuất bản / rút / xuất bản lại một sản phẩm; Ban quản lý chỉ được rút. */
  async changeProduct(
    actor: Actor,
    productId: string,
    event: ProductEvent,
    expectedVersion: number,
    reason?: string,
  ): Promise<ProductDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const product = await em.findOne(Product, productId, { populate: ['household'] });
      if (!product) throw notFound();
      const household = product.household;
      const isOwner = household.representative.id === actor.id;
      if (actor.role !== 'ADMIN' && !isOwner)
        throw await deniedAccess(this.orm, actor, 'product', product.id);
      if (isOwner && actor.locked) throw new AppError('HOUSEHOLD_ACCOUNT_LOCKED');
      assertVersion(product, expectedVersion);

      const next = productTransition(product.status, event, {
        actorRole: actor.role,
        isOwner,
        householdStatus: household.status,
        reason,
      });
      if (!next.ok && next.error.code === 'HOUSEHOLD_NOT_APPROVED') {
        throw new AppError('HOUSEHOLD_NOT_APPROVED');
      }
      // FR-PRD-03 / GH#251: a product needs at least one production-log milestone before it goes public.
      if (
        next.ok &&
        isOwner &&
        (event === 'PUBLISH' || event === 'REPUBLISH') &&
        (await em.count(JournalEntry, { product })) === 0
      ) {
        throw new AppError('PRODUCT_JOURNAL_REQUIRED');
      }
      const before = product.status;
      product.status = unwrap(next);
      if (product.status === 'PUBLISHED') {
        product.publishedAt ??= new Date();
        product.withdrawnReason = null;
      } else if (product.status === 'WITHDRAWN') {
        product.withdrawnReason = reason ?? null;
      }
      if (actor.role === 'ADMIN') {
        em.create(AuditLog, {
          actorId: actor.id,
          action: `product.${event.toLowerCase()}`,
          entity: 'product',
          entityId: product.id,
          before: { status: before },
          after: { status: product.status, reason: reason ?? null },
        });
      }
      queueKnowledgeChange(em, 'PRODUCT', product.id);
      await em.flush();
      return toProductDto(product, (await this.makersOf(em, [product])).get(product.id));
    });
  }

  /** Ghi công người làm (thay cả danh sách). Người đăng không bao giờ được ghi là người làm. */
  async setMakers(
    actor: Actor,
    productId: string,
    input: SetProductMakersRequest,
  ): Promise<ProductDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await this.ownWritableHousehold(em, actor);
      const product = await this.ownProduct(em, actor, household, productId);
      const artisans = await em.find(Artisan, { household });
      unwrap(checkMakerCredits(input.makers, new Set(artisans.map((a) => a.id))));
      for (const maker of await em.find(ProductMaker, { product })) em.remove(maker);
      await em.flush();
      input.makers.forEach((credit, position) => {
        em.create(ProductMaker, {
          product,
          artisan: em.getReference(Artisan, credit.artisanId),
          contribution: credit.contribution,
          position,
        });
      });
      await em.flush();
      return toProductDto(product, (await this.makersOf(em, [product])).get(product.id));
    });
  }

  // --- Ban quản lý ---

  /** Hàng đợi duyệt: hồ sơ nộp trước đứng trước; `from`/`to` là ngày theo giờ Việt Nam. */
  async listForAdmin(filters: {
    status?: HouseholdStatus | undefined;
    from?: string | undefined;
    to?: string | undefined;
  }): Promise<AdminHouseholdDto[]> {
    const em = this.orm.em.fork();
    const households = await em.find(
      Household,
      {
        ...(filters.status && { status: filters.status }),
        ...((filters.from || filters.to) && {
          createdAt: {
            ...(filters.from && { $gte: new Date(`${filters.from}T00:00:00.000+07:00`) }),
            ...(filters.to && { $lte: new Date(`${filters.to}T23:59:59.999+07:00`) }),
          },
        }),
      },
      { orderBy: { createdAt: 'asc' } },
    );
    return households.map((h) => ({
      id: h.id,
      version: h.version,
      name: h.name,
      status: h.status,
      reviewState: householdReviewState(h.status, h.statusReason, h.resubmittedAt),
      resubmittedAt: h.resubmittedAt ? h.resubmittedAt.toISOString() : null,
      submittedAt: h.createdAt.toISOString(),
    }));
  }

  /** Hồ sơ đầy đủ cho màn duyệt, ở mọi trạng thái. */
  async getForAdmin(householdId: string): Promise<HouseholdDto> {
    const em = this.orm.em.fork();
    const household = await em.findOne(Household, householdId);
    if (!household) throw notFound();
    return toHouseholdDto(household, await this.parts(em, household, false));
  }

  /** Giấy tờ riêng tư do người đại diện tải lên; nội dung đọc qua `GET /media/:id/read-url`. */
  async documentsForAdmin(householdId: string): Promise<{ data: HouseholdDocumentDto[] }> {
    const em = this.orm.em.fork();
    const household = await em.findOne(Household, householdId);
    if (!household) throw notFound();
    const assets = await em.find(
      MediaAsset,
      { ownerId: household.representative.id, purpose: 'CERTIFICATE', visibility: 'PRIVATE' },
      { orderBy: { createdAt: 'asc' } },
    );
    const links = await em.find(MediaLink, {
      targetType: 'HOUSEHOLD',
      targetId: householdId,
      role: 'DOCUMENT',
      media: { $in: assets.map((a) => a.id) },
    });
    const caption = new Map(links.map((l) => [l.media.id, l.caption ?? null]));
    return {
      data: assets.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        caption: caption.get(a.id) ?? null,
        certificateKind: a.certificateKind ?? 'UNKNOWN',
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async dashboard(): Promise<AdminDashboardDto> {
    const em = this.orm.em.fork();
    const dates = last30VietnamDates();
    const since = vietnamDayStartUtc(dates[0] ?? '');
    // Bounded time window (from the window start to the day after its last date) instead of every scan.
    const [activeHouseholds, pendingApplications, openRfqs, ordersInProduction, daily] =
      await Promise.all([
        em.count(Household, { status: 'APPROVED' }),
        em.count(Household, { status: 'PENDING_REVIEW' }),
        em.count(QuotationRequest, { status: { $in: ['SENT', 'BIDDING'] } }),
        em.count(QuotationRequest, { status: 'IN_PRODUCTION' }),
        this.scanTrend(em, since, dates[dates.length - 1] ?? ''),
      ]);
    const trend = zeroFilledTrend(dates, daily);
    return {
      activeHouseholds,
      pendingApplications,
      openRfqs,
      ordersInProduction,
      // The same 30-day Vietnam window as `trend`, so the total equals the sum of the daily points.
      qrScans30Days: trend.reduce((sum, point) => sum + point.count, 0),
      trend,
    };
  }

  /**
   * Aggregated scans per Vietnam calendar date over the bounded window: one GROUP BY query answering
   * at most 30 rows, never one row per scan. The date expression is driver-specific and always yields
   * an ISO `YYYY-MM-DD` string (`to_char(...)` on PostgreSQL, `date_format(...)` on MySQL — the
   * columns are UTC), while the window bounds travel as parameters so the plan keeps using the
   * `trace_scan.created_at` index.
   */
  private scanTrend(em: EntityManager, since: Date, lastDate: string): Promise<ScanDayRow[]> {
    const until = new Date(vietnamDayStartUtc(lastDate).getTime() + DAY_MS);
    const dayExpr =
      this.driver === 'mysql'
        ? "date_format(date_add(created_at, interval 7 hour), '%Y-%m-%d')"
        : "to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')";
    const sql =
      `select ${dayExpr} as day, count(*) as count from trace_scan` +
      ' where created_at >= ? and created_at < ? group by 1';
    return em
      .getConnection()
      .execute(sql, [since, until])
      .then((rows) =>
        (rows as ScanDayRow[]).map((row) => ({
          day: String(row.day).slice(0, 10),
          count: Number(row.count),
        })),
      );
  }

  /**
   * Ghi một lượt quét QR; mã không tồn tại hoặc không còn công khai thì bỏ qua, không báo lỗi.
   * FR-TRC-06: the country and device class are optional; an IP address is never stored.
   */
  async recordScan(traceCode: string, input: RecordScanRequest = {}): Promise<void> {
    await this.orm.em.fork().transactional(async (em) => {
      const product = await em.findOne(
        Product,
        { traceCode: traceCode.toUpperCase() },
        { populate: ['household'] },
      );
      if (!product) return;
      if (publicProductAvailability(product.household.status, product.status) !== 'VISIBLE') return;
      em.create(TraceScan, {
        product,
        country: input.country ?? null,
        deviceType: input.deviceType ?? null,
      });
    });
  }

  /**
   * FR-TRC-06: scan statistics of the household's own product. The series covers the last 30 days in
   * Vietnam time (UTC+7, no daylight saving), so `last30Days` equals the sum of `daily`; the breakdowns
   * cover the same window. Another household's product is a denied, audited attempt (AC-4).
   */
  async scanStats(actor: Actor, productId: string): Promise<ProductScanStatsDto> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor);
    const product = await this.ownProduct(em, actor, household, productId);
    const dayMs = 24 * 60 * 60 * 1000;
    const vietnamOffsetMs = 7 * 60 * 60 * 1000;
    const today = new Date(Date.now() + vietnamOffsetMs).toISOString().slice(0, 10);
    const days = Array.from({ length: 30 }, (_, i) =>
      new Date(Date.parse(`${today}T00:00:00Z`) - (29 - i) * dayMs).toISOString().slice(0, 10),
    );
    const since = new Date(Date.parse(`${days[0]}T00:00:00Z`) - vietnamOffsetMs);
    const [total, recent] = await Promise.all([
      em.count(TraceScan, { product }),
      em.find(TraceScan, { product, createdAt: { $gte: since } }),
    ]);
    const perDay = new Map<string, number>();
    const perCountry = new Map<string | null, number>();
    const perDevice = new Map<string | null, number>();
    const bump = <K>(map: Map<K, number>, key: K) => map.set(key, (map.get(key) ?? 0) + 1);
    for (const scan of recent) {
      bump(perDay, new Date(scan.createdAt.getTime() + vietnamOffsetMs).toISOString().slice(0, 10));
      bump(perCountry, scan.country ?? null);
      bump(perDevice, scan.deviceType ?? null);
    }
    const ranked = <K>(map: Map<K, number>) => [...map].sort((a, b) => b[1] - a[1]);
    return {
      total,
      last30Days: recent.length,
      daily: days.map((date) => ({ date, count: perDay.get(date) ?? 0 })),
      byCountry: ranked(perCountry)
        .slice(0, 10)
        .map(([country, count]) => ({ country, count })),
      byDeviceType: ranked(perDevice).map(([deviceType, count]) => ({
        deviceType: deviceType as ProductScanStatsDto['byDeviceType'][number]['deviceType'],
        count,
      })),
    };
  }

  async decide(
    actor: Actor,
    householdId: string,
    event: HouseholdEvent,
    expectedVersion: number,
    reason?: string,
  ): Promise<HouseholdDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const household = await em.findOne(Household, householdId);
      if (!household) throw notFound();
      assertVersion(household, expectedVersion);
      const before = household.status;
      household.status = unwrap(
        householdTransition(before, event, { actorRole: actor.role, reason }),
      );
      household.statusReason = household.status === 'APPROVED' ? null : (reason ?? null);
      if (household.status === 'APPROVED') household.approvedAt ??= new Date();
      em.create(AuditLog, {
        actorId: actor.id,
        action: `household.${event.toLowerCase()}`,
        entity: 'household',
        entityId: household.id,
        before: { status: before },
        after: { status: household.status, reason: reason ?? null },
      });
      // Thư báo quyết định đi qua outbox cùng giao dịch: quyết định lưu được thì thư mới được gửi.
      em.create(OutboxEvent, {
        type: 'household.decision',
        payload: { householdId: household.id, decision: event, reason: reason ?? null },
      });
      // Người đại diện cũng nhận kết quả trong chuông (GH#37). Thư đã có ở sự kiện trên (kèm lý do)
      // nên không xếp thêm thư thứ hai; worker tôn trọng tùy chọn email theo loại khi gửi thư đó.
      this.notifications.publish(em, {
        type: householdNoticeKind(event),
        subjectId: household.id,
        actorId: actor.id,
        recipientIds: [household.representative.id],
        email: false,
      });
      // Approval, suspension and reinstatement change what is public, products included.
      queueKnowledgeChange(em, 'HOUSEHOLD', household.id);
      await em.flush();
      return toHouseholdDto(household, await this.parts(em, household, false));
    });
  }

  // --- Công khai ---

  /** Hồ sơ công khai chỉ khi hộ APPROVED; chỉ kèm sản phẩm đã xuất bản. Ngoài ra 404. */
  async getPublic(slug: string): Promise<PublicHouseholdDto> {
    const em = this.orm.em.fork();
    const household = await em.findOne(Household, { slug });
    if (!household || !isHouseholdPublic(household.status)) throw notFound();
    return toPublicHouseholdDto(household, await this.parts(em, household, true));
  }

  /** Tra mã QR: hiện đầy đủ, chỉ thông báo "không còn trưng bày", hoặc 404 (vCRAFT-9hg.3). */
  async trace(traceCode: string): Promise<TraceAvailabilityDto> {
    const em = this.orm.em.fork();
    const product = await em.findOne(
      Product,
      { traceCode: traceCode.toUpperCase() },
      { populate: ['household'] },
    );
    if (!product) throw notFound();
    const availability = publicProductAvailability(product.household.status, product.status);
    if (availability === 'MISSING') throw notFound();
    if (availability === 'UNAVAILABLE') {
      return {
        availability,
        traceCode: product.traceCode,
        reason:
          product.household.status === 'SUSPENDED' ? 'HOUSEHOLD_SUSPENDED' : 'PRODUCT_WITHDRAWN',
      };
    }
    // Independent reads run together: sequential awaits cost one database round trip each (GH#255).
    const [covers, makers, media, journal, scanCount] = await Promise.all([
      this.media.productCoverImages([product]),
      this.makersOf(em, [product]),
      this.media.publicMedia(productMediaIds([product])),
      loadJournal(em, product, this.media),
      em.count(TraceScan, { product }),
    ]);
    return {
      availability,
      product: toProductDto(product, makers.get(product.id), media, covers.get(product.id)),
      // The cover credit is the first linked cover image's: the same row set `productCoverImages` just read.
      coverCredit: covers.get(product.id)?.[0]?.credit ?? null,
      household: {
        name: product.household.name,
        slug: product.household.slug,
        status: product.household.status,
      },
      journal,
      scanCount,
    };
  }

  /** Ghim bản đồ làng: xưởng có tọa độ của mọi hộ đang được duyệt. */
  async mapPins(): Promise<MapPinsDto> {
    const em = this.orm.em.fork();
    const workshops = await em.find(
      Workshop,
      { household: { status: 'APPROVED' }, lat: { $ne: null }, lng: { $ne: null } },
      { populate: ['household'], orderBy: { household: { name: 'asc' }, name: 'asc' } },
    );
    return { data: workshops.map(toMapPinDto) };
  }

  // --- Nội bộ ---

  private async ownHousehold(em: EntityManager, actor: Actor): Promise<Household> {
    const household = await em.findOne(Household, { representative: actor.id });
    if (!household) throw notFound('this account does not represent a household');
    return household;
  }

  /** Khóa người đại diện đóng băng việc ghi; hộ bị từ chối không ghi tiếp được. */
  private async ownWritableHousehold(em: EntityManager, actor: Actor): Promise<Household> {
    if (actor.locked) throw new AppError('HOUSEHOLD_ACCOUNT_LOCKED');
    const household = await this.ownHousehold(em, actor);
    if (household.status === 'REJECTED') throw new AppError('HOUSEHOLD_NOT_APPROVED');
    return household;
  }

  /**
   * FR-AUTH-02 (GH#237): a household under review (or suspended) sees its application and records but posts
   * no new products until the village board approves it.
   */
  private async ownApprovedHousehold(em: EntityManager, actor: Actor): Promise<Household> {
    const household = await this.ownWritableHousehold(em, actor);
    if (household.status !== 'APPROVED') throw forbidden('the household is not approved yet');
    return household;
  }

  /** The household's own product; another household's product is a denied, audited attempt (AC-4). */
  private async ownProduct(
    em: EntityManager,
    actor: Actor,
    household: Household,
    productId: string,
  ): Promise<Product> {
    const product = await em.findOne(Product, productId);
    if (!product) throw notFound();
    if (product.household.id !== household.id)
      throw await deniedAccess(this.orm, actor, 'product', product.id);
    return product;
  }

  private maskedIdNumber(household: Household): string | null {
    if (!household.idNumberEnc) return null;
    return maskIdNumber(
      this.cipher.decrypt(household.idNumberEnc, FIELD_CONTEXTS.householdIdNumber),
    );
  }

  private async parts(
    em: EntityManager,
    household: Household,
    publicOnly: boolean,
  ): Promise<HouseholdParts> {
    const [artisans, workshops, products] = await Promise.all([
      em.find(Artisan, { household }, { orderBy: { createdAt: 'asc' } }),
      em.find(Workshop, { household }, { orderBy: { createdAt: 'asc' } }),
      em.find(Product, publicOnly ? { household, status: 'PUBLISHED' } : { household }, {
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const mediaIds = [
      ...(household.gallery ?? []).flatMap((item) => (item.mediaId ? [item.mediaId] : [])),
      ...(household.timeline ?? []).flatMap((e) => (e.photo ? [e.photo.mediaId] : [])),
      ...productMediaIds(products),
    ];
    // Three independent reads: together they cost one round trip instead of three (GH#255).
    const [linked, makers, media] = await Promise.all([
      this.media.linkedImages('HOUSEHOLD', [household.id], ['PORTRAIT', 'BANNER', 'GALLERY']),
      this.makersOf(em, products),
      this.media.publicMedia(mediaIds),
    ]);
    return {
      artisans,
      workshops,
      products,
      idNumberMasked: this.maskedIdNumber(household),
      makers,
      media,
      linked: linked.get(household.id) ?? [],
    };
  }

  private async makersOf(
    em: EntityManager,
    products: readonly Product[],
  ): Promise<Map<string, ProductMaker[]>> {
    const byProduct = new Map<string, ProductMaker[]>();
    if (products.length === 0) return byProduct;
    const makers = await em.find(
      ProductMaker,
      { product: { $in: products.map((p) => p.id) } },
      { populate: ['artisan'], orderBy: { position: 'asc' } },
    );
    for (const maker of makers) {
      const list = byProduct.get(maker.product.id) ?? [];
      list.push(maker);
      byProduct.set(maker.product.id, list);
    }
    return byProduct;
  }

  private async uniqueTraceCode(em: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateTraceCode();
      if ((await em.count(Product, { traceCode: code })) === 0) return code;
    }
    throw new AppError('INTERNAL_ERROR', 'could not allocate a trace code');
  }
}
