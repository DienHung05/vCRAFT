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
  PublicHouseholdDto,
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
  MediaAsset,
  MediaLink,
  OutboxEvent,
  Product,
  ProductMaker,
  QuotationRequest,
  TraceScan,
  Workshop,
} from '@vcraft/database';
import {
  checkMakerCredits,
  type HouseholdEvent,
  type HouseholdStatus,
  householdNoticeKind,
  householdTransition,
  isHouseholdPublic,
  maskIdNumber,
  type ProductEvent,
  productTransition,
  publicProductAvailability,
} from '@vcraft/domain';
import { slugify } from '@vcraft/utils';
import type { Actor } from '../../../common/auth/auth.guard';
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
        household.timeline = [...input.timeline].sort((a, b) => a.year - b.year);
      }
      if (input.capacityByCategory !== undefined) {
        household.capacityByCategory = input.capacityByCategory;
      }
      await em.flush();
      return household.id;
    });
    const em = this.orm.em.fork();
    const household = await em.findOneOrFail(Household, updated);
    return toHouseholdDto(household, await this.parts(em, household, false));
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
      const household = await this.ownWritableHousehold(em, actor);
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
      const product = await em.findOne(Product, { id: productId, household });
      if (!product) throw notFound();
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
      if (actor.role !== 'ADMIN' && !isOwner) throw notFound();
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
      const product = await em.findOne(Product, { id: productId, household });
      if (!product) throw notFound();
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
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async dashboard(): Promise<AdminDashboardDto> {
    const em = this.orm.em.fork();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [activeHouseholds, pendingApplications, openRfqs, ordersInProduction, qrScans30Days] =
      await Promise.all([
        em.count(Household, { status: 'APPROVED' }),
        em.count(Household, { status: 'PENDING_REVIEW' }),
        em.count(QuotationRequest, { status: { $in: ['SENT', 'BIDDING'] } }),
        em.count(QuotationRequest, { status: 'IN_PRODUCTION' }),
        em.count(TraceScan, { createdAt: { $gte: since } }),
      ]);
    return { activeHouseholds, pendingApplications, openRfqs, ordersInProduction, qrScans30Days };
  }

  /** Ghi một lượt quét QR; mã không tồn tại hoặc không còn công khai thì bỏ qua, không báo lỗi. */
  async recordScan(traceCode: string): Promise<void> {
    await this.orm.em.fork().transactional(async (em) => {
      const product = await em.findOne(
        Product,
        { traceCode: traceCode.toUpperCase() },
        { populate: ['household'] },
      );
      if (!product) return;
      if (publicProductAvailability(product.household.status, product.status) !== 'VISIBLE') return;
      em.create(TraceScan, { product });
    });
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
    const covers = await this.media.productCoverImages([product]);
    return {
      availability,
      product: toProductDto(
        product,
        (await this.makersOf(em, [product])).get(product.id),
        await this.media.publicMedia(productMediaIds([product])),
        covers.get(product.id),
      ),
      coverCredit: await this.media.productCoverCredit(product),
      household: { name: product.household.name, slug: product.household.slug },
      journal: await loadJournal(em, product, this.media),
      scanCount: await em.count(TraceScan, { product }),
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
    const linked = await this.media.linkedImages(
      'HOUSEHOLD',
      [household.id],
      ['PORTRAIT', 'BANNER', 'GALLERY'],
    );
    const mediaIds = [
      ...(household.gallery ?? []).flatMap((item) => (item.mediaId ? [item.mediaId] : [])),
      ...productMediaIds(products),
    ];
    return {
      artisans,
      workshops,
      products,
      idNumberMasked: this.maskedIdNumber(household),
      makers: await this.makersOf(em, products),
      media: await this.media.publicMedia(mediaIds),
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
