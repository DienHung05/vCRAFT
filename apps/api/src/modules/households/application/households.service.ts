import { type EntityManager, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  ApplyHouseholdRequest,
  CreateArtisanRequest,
  CreateProductRequest,
  CreateWorkshopRequest,
  HouseholdDto,
  MapPinsDto,
  ProductDto,
  PublicHouseholdDto,
  SetProductMakersRequest,
  TraceAvailabilityDto,
  UpdateHouseholdProfileRequest,
  UpdateProductRequest,
} from '@vcraft/contracts';
import {
  AppUser,
  Artisan,
  AuditLog,
  Household,
  Product,
  ProductMaker,
  Workshop,
} from '@vcraft/database';
import {
  checkMakerCredits,
  type HouseholdEvent,
  type HouseholdStatus,
  householdTransition,
  isHouseholdPublic,
  type ProductEvent,
  productTransition,
  publicProductAvailability,
} from '@vcraft/domain';
import { slugify } from '@vcraft/utils';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
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
import { generateTraceCode } from './trace-code';

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
  ) {}

  // --- Người đại diện hộ ---

  async apply(actor: Actor, input: ApplyHouseholdRequest): Promise<HouseholdDto> {
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
        representative: user,
      });
      await em.flush();
      return toHouseholdDto(household, {
        artisans: [],
        workshops: [],
        products: [],
        makers: new Map(),
      });
    });
  }

  /** Bản ghi riêng: luôn đọc được kể cả khi hộ bị tạm ngừng hay từ chối. */
  async getMine(actor: Actor): Promise<HouseholdDto> {
    const em = this.orm.em.fork();
    const household = await this.ownHousehold(em, actor);
    return toHouseholdDto(household, await this.parts(em, household, false));
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
      const base = slugify(input.name) || 'san-pham';
      const product = em.create(Product, {
        household,
        name: input.name,
        slug: `${base}-${traceCode.toLowerCase()}`,
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
        }
      }
      if (input.name !== undefined) product.name = input.name;
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
      await this.media.publicUrls(productMediaIds([product])),
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

  async listForAdmin(status?: HouseholdStatus): Promise<HouseholdDto[]> {
    const em = this.orm.em.fork();
    const households = await em.find(Household, status ? { status } : {}, {
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      households.map(async (h) => toHouseholdDto(h, await this.parts(em, h, false))),
    );
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
    return {
      availability,
      product: toProductDto(
        product,
        (await this.makersOf(em, [product])).get(product.id),
        await this.media.publicUrls(productMediaIds([product])),
      ),
      household: { name: product.household.name, slug: product.household.slug },
      journal: await loadJournal(em, product),
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
      ...productMediaIds(products),
    ];
    return {
      artisans,
      workshops,
      products,
      makers: await this.makersOf(em, products),
      mediaUrls: await this.media.publicUrls(mediaIds),
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
