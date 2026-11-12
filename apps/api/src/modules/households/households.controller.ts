import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  type ApplyHouseholdRequest,
  ApplyHouseholdRequestSchema,
  type CreateArtisanRequest,
  CreateArtisanRequestSchema,
  type CreateProductRequest,
  CreateProductRequestSchema,
  CreateQrLabelsRequestSchema,
  type CreateWorkshopRequest,
  CreateWorkshopRequestSchema,
  HouseholdDecisionRequestSchema,
  type ListHouseholdsQuery,
  ListHouseholdsQuerySchema,
  type MapPinsQuery,
  MapPinsQuerySchema,
  type PriceSuggestionQuery,
  PriceSuggestionQuerySchema,
  type RecordScanRequest,
  RecordScanRequestSchema,
  type SetCertificationVerificationRequest,
  SetCertificationVerificationRequestSchema,
  type SetIdNumberRequest,
  SetIdNumberRequestSchema,
  type SetProductMakersRequest,
  SetProductMakersRequestSchema,
  SlugAvailabilityQuerySchema,
  type UpdateHouseholdProfileRequest,
  UpdateHouseholdProfileRequestSchema,
  type UpdateProductRequest,
  UpdateProductRequestSchema,
  WithdrawProductRequestSchema,
} from '@vcraft/contracts';
import type { HouseholdEvent } from '@vcraft/domain';
import { type Actor, CurrentActor, Public, Roles } from '../../common/auth/auth.guard';
import { notFound } from '../../common/errors/app-error';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { IfMatchVersion } from '../../common/http/if-match';
import { withPublicCache } from '../../common/http/public-cache';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HouseholdsService } from './application/households.service';
import { QrLabelsService } from './application/qr-labels.service';
import {
  type ScanRequestLike,
  visitorIdentity,
  visitorUserAgent,
} from './application/scan-visitor';
import { StorySuggestionService } from './application/story-suggestion.service';

/** Hồ sơ hộ của chính người đại diện (`/me/household`). */
@Controller('me/household')
export class MyHouseholdController {
  constructor(
    private readonly households: HouseholdsService,
    private readonly qrLabels: QrLabelsService,
    private readonly storySuggestions: StorySuggestionService,
  ) {}

  /**
   * FR-ART-08: a suggested story in Vietnamese and English from the profile facts. Never saved; 503 when the
   * chat model is not configured.
   */
  @Post('story-suggestion')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  storySuggestion(@CurrentActor() actor: Actor) {
    return this.storySuggestions.suggest(actor);
  }

  /** Queue an A4 QR label sheet for some of the household's products (PLAN E6); poll the status. */
  @Post('qr-labels')
  @HttpCode(202)
  @Roles('HOUSEHOLD')
  requestQrLabels(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateQrLabelsRequestSchema))
    body: { productIds: string[]; copies: number },
  ) {
    return this.qrLabels.request(actor, body);
  }

  @Get('qr-labels/:requestId')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  qrLabelsStatus(
    @CurrentActor() actor: Actor,
    @Param('requestId', new UuidPipe()) requestId: string,
  ) {
    return this.qrLabels.status(actor, requestId);
  }

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

  /** Final wizard step: the draft application enters the board's queue (needs profile, workshop, document). */
  @Post('submit')
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  submit(@CurrentActor() actor: Actor) {
    return this.households.submit(actor);
  }

  /** The household's own uploaded documents, so a returning wizard user does not upload them again. */
  @Get('documents')
  @Roles('HOUSEHOLD')
  @Header('Cache-Control', 'private, no-store')
  documents(@CurrentActor() actor: Actor) {
    return this.households.documentsForMine(actor);
  }

  @Patch()
  @Roles('HOUSEHOLD')
  updateProfile(
    @CurrentActor() actor: Actor,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(UpdateHouseholdProfileRequestSchema))
    body: UpdateHouseholdProfileRequest,
  ) {
    return this.households.updateProfile(actor, version, body);
  }

  /** Explicit resubmission after edits (vCRAFT-8my.2); `If-Match` guards against stale writes. */
  @Post('resubmit')
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  resubmit(@CurrentActor() actor: Actor, @IfMatchVersion() version: number) {
    return this.households.resubmit(actor, version);
  }

  @Put('id-number')
  @Roles('HOUSEHOLD')
  setIdNumber(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(SetIdNumberRequestSchema)) body: SetIdNumberRequest,
  ) {
    return this.households.setIdNumber(actor, body);
  }

  @Put('workshops/:id')
  @Roles('HOUSEHOLD')
  updateWorkshop(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CreateWorkshopRequestSchema))
    body: CreateWorkshopRequest,
  ) {
    return this.households.updateWorkshop(actor, id, version, body);
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
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(SetProductMakersRequestSchema)) body: SetProductMakersRequest,
  ) {
    return this.households.setMakers(actor, id, version, body);
  }

  /** FR-TRC-06: scan statistics of one of the household's own products. */
  @Get('products/:id/scans')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  scanStats(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.households.scanStats(actor, id);
  }

  /** FR-PRD-07: median price of published products in a category; declared before `products/:id`. */
  @Get('products/price-suggestion')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  priceSuggestion(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(PriceSuggestionQuerySchema)) query: PriceSuggestionQuery,
  ) {
    return this.households.priceSuggestion(actor, query.category);
  }

  /** FR-PRD-06: a DRAFT copy without the production journal. */
  @Post('products/:id/duplicate')
  @Idempotent()
  @Roles('HOUSEHOLD')
  duplicateProduct(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.households.duplicateProduct(actor, id);
  }

  @Patch('products/:id')
  @Roles('HOUSEHOLD')
  updateProduct(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(UpdateProductRequestSchema)) body: UpdateProductRequest,
  ) {
    return this.households.updateProduct(actor, id, version, body);
  }

  @Post('products')
  @Idempotent()
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

  /** One-of-a-kind products only: PUBLISHED to SOLD (FR-PRD-01). */
  @Post('mark-sold')
  @HttpCode(200)
  markSold(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.households.changeProduct(actor, id, 'MARK_SOLD', version);
  }

  /** Undo a sale: SOLD back to PUBLISHED. */
  @Post('back-on-sale')
  @HttpCode(200)
  backOnSale(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.households.changeProduct(actor, id, 'BACK_ON_SALE', version);
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
  'request-info': 'REQUEST_INFO',
  suspend: 'SUSPEND',
  reinstate: 'REINSTATE',
};

@Controller('admin/dashboard')
@Roles('ADMIN')
export class AdminDashboardController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  get() {
    return this.households.dashboard();
  }
}

/** Ban quản lý duyệt hộ (`/admin/households`). */
@Controller('admin/households')
@Roles('ADMIN')
export class AdminHouseholdsController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ListHouseholdsQuerySchema))
    query: ListHouseholdsQuery,
  ) {
    return this.households.listForAdmin(query);
  }

  @Get(':id')
  getOne(@Param('id', new UuidPipe()) id: string) {
    return this.households.getForAdmin(id);
  }

  /** Full citizen ID number, only on request; every call is written to the audit log. */
  @Get(':id/id-number')
  @Header('Cache-Control', 'private, no-store')
  idNumber(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.households.revealIdNumber(actor, id);
  }

  @Get(':id/documents')
  documents(@Param('id', new UuidPipe()) id: string) {
    return this.households.documentsForAdmin(id);
  }

  /** FR-ART-03: mark one certification verified, or remove the mark (audited). */
  @Put(':id/certifications/:index/verification')
  setCertificationVerification(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Param('index') index: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(SetCertificationVerificationRequestSchema))
    body: SetCertificationVerificationRequest,
  ) {
    if (!/^\d{1,3}$/.test(index)) throw notFound();
    return this.households.setCertificationVerified(
      actor,
      id,
      Number(index),
      version,
      body.verified,
    );
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

/**
 * `GET /households/slug-availability?slug=`: live duplicate check for the address a household types
 * (FR-ART-01). Any signed-in account may ask, because the sign-up wizard asks before the account is
 * a representative; the household's own slug counts as free.
 */
@Controller('households/slug-availability')
export class HouseholdSlugController {
  constructor(private readonly households: HouseholdsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  check(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(SlugAvailabilityQuerySchema)) query: { slug: string },
  ) {
    return this.households.slugAvailability(actor, query.slug);
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

  /** Ghim bản đồ làng; trang luôn hiện kèm danh sách chữ. `?bbox=` loads one viewport (FR-MAP-04). */
  @Get('map/workshops')
  async mapPins(
    @Query(new ZodValidationPipe(MapPinsQuerySchema)) query: MapPinsQuery,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    return withPublicCache(request, reply, await this.households.mapPins(query.bbox));
  }

  @Get('trace/:code')
  trace(@Param('code') code: string) {
    return this.households.trace(code);
  }

  /**
   * Đường dẫn ngắn `/q/<code>` báo một lượt quét; luôn 204 để không dò được mã nào tồn tại.
   * The body (country, device class) is optional, so clients that send none still work.
   */
  @Post('trace/:code/scan')
  @HttpCode(204)
  async scan(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(RecordScanRequestSchema)) body: RecordScanRequest,
    @Req() request: ScanRequestLike,
  ) {
    // GH#362: repeats from one visitor within 30 minutes count once; the answer is the same either way.
    await this.households.recordScan(
      code,
      body,
      visitorIdentity(request),
      visitorUserAgent(request),
    );
  }
}
