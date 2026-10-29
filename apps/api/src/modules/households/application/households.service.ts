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
import { loadJournal } from '../../production-logs/application/journal.queries';
import {
  type HouseholdParts,
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
  constructor(private readonly orm: MikroORM) {}

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
      });
      await em.flush();
      return toProductDto(product);
    });
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
      return { availability, traceCode: product.traceCode };
    }
    return {
      availability,
      product: toProductDto(product, (await this.makersOf(em, [product])).get(product.id)),
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
    return { artisans, workshops, products, makers: await this.makersOf(em, products) };
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
