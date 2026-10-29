import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import {
  type ApplyHouseholdRequest,
  ApplyHouseholdRequestSchema,
  type CreateArtisanRequest,
  CreateArtisanRequestSchema,
  type CreateProductRequest,
  CreateProductRequestSchema,
  type CreateWorkshopRequest,
  CreateWorkshopRequestSchema,
  HouseholdDecisionRequestSchema,
  ListHouseholdsQuerySchema,
  type SetProductMakersRequest,
  SetProductMakersRequestSchema,
  WithdrawProductRequestSchema,
} from '@vcraft/contracts';
import type { HouseholdEvent } from '@vcraft/domain';
import { type Actor, CurrentActor, Public, Roles } from '../../common/auth/auth.guard';
import { notFound } from '../../common/errors/app-error';
import { IfMatchVersion } from '../../common/http/if-match';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HouseholdsService } from './application/households.service';

/** Hồ sơ hộ của chính người đại diện (`/me/household`). */
@Controller('me/household')
export class MyHouseholdController {
  constructor(private readonly households: HouseholdsService) {}

  @Post()
  apply(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(ApplyHouseholdRequestSchema))
    body: ApplyHouseholdRequest,
  ) {
    return this.households.apply(actor, body);
  }

  @Get()
  @Roles('HOUSEHOLD')
  get(@CurrentActor() actor: Actor) {
    return this.households.getMine(actor);
  }

  @Post('workshops')
  @Roles('HOUSEHOLD')
  addWorkshop(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateWorkshopRequestSchema))
    body: CreateWorkshopRequest,
  ) {
    return this.households.addWorkshop(actor, body);
  }

  @Post('artisans')
  @Roles('HOUSEHOLD')
  addArtisan(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateArtisanRequestSchema))
    body: CreateArtisanRequest,
  ) {
    return this.households.addArtisan(actor, body);
  }

  @Put('products/:id/makers')
  @Roles('HOUSEHOLD')
  setMakers(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(SetProductMakersRequestSchema)) body: SetProductMakersRequest,
  ) {
    return this.households.setMakers(actor, id, body);
  }

  @Post('products')
  @Roles('HOUSEHOLD')
  createProduct(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateProductRequestSchema))
    body: CreateProductRequest,
  ) {
    return this.households.createProduct(actor, body);
  }
}

/** Đổi trạng thái xuất bản sản phẩm (`If-Match` bắt buộc). */
@Controller('products/:id')
@Roles('HOUSEHOLD', 'ADMIN')
export class ProductPublicationController {
  constructor(private readonly households: HouseholdsService) {}

  @Post('publish')
  @HttpCode(200)
  publish(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.households.changeProduct(actor, id, 'PUBLISH', version);
  }

  @Post('republish')
  @HttpCode(200)
  republish(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.households.changeProduct(actor, id, 'REPUBLISH', version);
  }

  @Post('withdraw')
  @HttpCode(200)
  withdraw(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(WithdrawProductRequestSchema)) body: { reason: string },
  ) {
    return this.households.changeProduct(actor, id, 'WITHDRAW', version, body.reason);
  }
}

const HOUSEHOLD_ACTIONS: Record<string, HouseholdEvent> = {
  approve: 'APPROVE',
  reject: 'REJECT',
  suspend: 'SUSPEND',
  reinstate: 'REINSTATE',
};

/** Ban quản lý duyệt hộ (`/admin/households`). */
@Controller('admin/households')
@Roles('ADMIN')
export class AdminHouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ListHouseholdsQuerySchema))
    query: ReturnType<typeof ListHouseholdsQuerySchema.parse>,
  ) {
    return this.households.listForAdmin(query.status);
  }

  /** `POST /admin/households/:id/{approve|reject|suspend|reinstate}`. */
  @Post(':id/:action')
  @HttpCode(200)
  decide(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Param('action') action: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(HouseholdDecisionRequestSchema)) body: { reason?: string },
  ) {
    const event = Object.hasOwn(HOUSEHOLD_ACTIONS, action) ? HOUSEHOLD_ACTIONS[action] : undefined;
    if (!event) throw notFound();
    return this.households.decide(actor, id, event, version, body.reason);
  }
}

/** Trang công khai: hồ sơ hộ và tra mã QR. */
@Controller()
@Public()
export class PublicHouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get('households/:slug')
  get(@Param('slug') slug: string) {
    return this.households.getPublic(slug);
  }

  /** Ghim bản đồ làng; trang luôn hiện kèm danh sách chữ. */
  @Get('map/workshops')
  mapPins() {
    return this.households.mapPins();
  }

  @Get('trace/:code')
  trace(@Param('code') code: string) {
    return this.households.trace(code);
  }
}
