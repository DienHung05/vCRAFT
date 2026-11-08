import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  type AcceptQuotationRequest,
  AcceptQuotationRequestSchema,
  type AllocationDto,
  type CancelOrderRequest,
  CancelOrderRequestSchema,
  type CreateContributionRequest,
  CreateContributionRequestSchema,
  type CreateCooperativeQuotationRequest,
  CreateCooperativeQuotationRequestSchema,
  type CreateDirectQuotationRequest,
  CreateDirectQuotationRequestSchema,
  type CreateRfqRequest,
  CreateRfqRequestSchema,
  formatVersionTag,
  InviteHouseholdsRequestSchema,
  type ListRfqsQuery,
  ListRfqsQuerySchema,
  type ReallocateRequest,
  ReallocateRequestSchema,
  type ReportProgressRequest,
  ReportProgressRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import type { HttpReply } from '../../common/http/http-types';
import { IfMatchVersion } from '../../common/http/if-match';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AllocationScheduleService } from './application/allocation-schedule.service';
import { RfqService } from './application/rfq.service';

@Controller('rfqs')
export class RfqController {
  constructor(private readonly rfqs: RfqService) {}

  @Post()
  @Idempotent()
  @Roles('BUYER')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateRfqRequestSchema)) body: CreateRfqRequest,
  ) {
    return this.rfqs.createRequest(actor, body);
  }

  @Post(':id/duplicate')
  @Roles('BUYER')
  duplicate(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.duplicateRequest(actor, id);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @Roles('BUYER')
  list(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(ListRfqsQuerySchema)) query: ListRfqsQuery,
  ) {
    return this.rfqs.listRequests(actor, query);
  }

  @Put(':id')
  @Roles('BUYER')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CreateRfqRequestSchema)) body: CreateRfqRequest,
  ) {
    return this.rfqs.updateRequest(actor, id, version, body);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    const response = await this.rfqs.getRequest(actor, id);
    reply.header('ETag', formatVersionTag(response.version));
    return response;
  }

  @Post(':id/submit')
  @Idempotent()
  @HttpCode(200)
  @Roles('BUYER')
  submit(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.submitRequest(actor, id, version);
  }

  @Post(':id/coordinate')
  @Idempotent()
  @HttpCode(200)
  @Roles('ADMIN')
  coordinate(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.coordinate(actor, id, version);
  }

  @Post(':id/invitations')
  @Idempotent()
  @HttpCode(200)
  @Roles('ADMIN')
  invite(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(InviteHouseholdsRequestSchema)) body: { householdIds: string[] },
  ) {
    return this.rfqs.invite(actor, id, version, body.householdIds);
  }

  @Get(':id/coordination')
  @Header('Cache-Control', 'private, no-store')
  @Roles('ADMIN')
  coordination(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.getCoordination(actor, id);
  }

  /** An invited household declines. Sealed: only that household's own state changes. */
  @Post(':id/decline')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  decline(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.declineInvitation(actor, id);
  }

  @Post(':id/contributions')
  @Idempotent()
  @Roles('HOUSEHOLD')
  createContribution(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(CreateContributionRequestSchema)) body: CreateContributionRequest,
  ) {
    return this.rfqs.createContribution(actor, id, body);
  }

  @Get(':id/price-hint')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  priceHint(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.priceHint(actor, id);
  }

  @Get(':id/contributions')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD', 'ADMIN')
  listContributions(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.listContributions(actor, id);
  }

  /** FR-RFQ-04: an invited household quotes the whole request itself (requests without coordination). */
  @Post(':id/direct-quotations')
  @Idempotent()
  @Roles('HOUSEHOLD')
  createDirectQuotation(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(CreateDirectQuotationRequestSchema))
    body: CreateDirectQuotationRequest,
  ) {
    return this.rfqs.createDirectQuotation(actor, id, body);
  }

  @Get(':id/direct-quotations')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD')
  listOwnDirectQuotations(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.listOwnDirectQuotations(actor, id);
  }

  @Post(':id/quotations')
  @Idempotent()
  @Roles('ADMIN')
  createCooperativeQuotation(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CreateCooperativeQuotationRequestSchema))
    body: CreateCooperativeQuotationRequest,
  ) {
    return this.rfqs.createCooperativeQuotation(actor, id, version, body);
  }

  @Get(':id/quotations')
  @Header('Cache-Control', 'private, no-store')
  @Roles('BUYER', 'ADMIN')
  listQuotations(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.listQuotations(actor, id);
  }

  /** GH#11: buyer chốt chào giá, sinh allocations PROPOSED. Version ở header `If-Match`. */
  @Post(':id/accept')
  @Idempotent()
  @HttpCode(200)
  @Roles('BUYER')
  accept(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(AcceptQuotationRequestSchema)) body: AcceptQuotationRequest,
  ) {
    return this.rfqs.acceptQuotation(actor, id, version, body);
  }

  /** GH#11: đọc allocations của đơn đã chốt. */
  @Get(':id/allocations')
  @Header('Cache-Control', 'private, no-store')
  @Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
  listAllocations(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.listAllocations(actor, id);
  }

  /** GH#11: admin hoặc hộ đơn-1-hộ bắt đầu sản xuất. */
  @Post(':id/start-production')
  @Idempotent()
  @HttpCode(200)
  @Roles('ADMIN', 'HOUSEHOLD')
  startProduction(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.startProduction(actor, id, version);
  }

  /** GH#11: buyer hoặc admin xác nhận đã nhận hàng. */
  @Post(':id/receive')
  @Idempotent()
  @HttpCode(200)
  @Roles('BUYER', 'ADMIN')
  receive(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.confirmReceipt(actor, id, version);
  }

  /** The owning buyer or the coordinator cancels. A reason is required. */
  @Post(':id/cancel')
  @Idempotent()
  @HttpCode(200)
  @Roles('BUYER', 'ADMIN')
  cancel(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CancelOrderRequestSchema)) body: CancelOrderRequest,
  ) {
    return this.rfqs.cancelOrder(actor, id, version, body.reason);
  }
}

@Controller('me')
@Roles('HOUSEHOLD')
export class MyQuotationWorkController {
  constructor(private readonly rfqs: RfqService) {}

  @Get('invitations')
  @Header('Cache-Control', 'private, no-store')
  invitations(@CurrentActor() actor: Actor) {
    return this.rfqs.listInvitations(actor);
  }

  @Get('allocations')
  @Header('Cache-Control', 'private, no-store')
  allocations(@CurrentActor() actor: Actor) {
    return this.rfqs.listMyAllocations(actor);
  }
}

@Controller('admin/coordination')
@Roles('ADMIN')
export class AdminCoordinationController {
  constructor(private readonly rfqs: RfqService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  queue(@CurrentActor() actor: Actor) {
    return this.rfqs.coordinationQueue(actor);
  }
}

/** Allocation timeline and reallocation for the village board (PLAN E10, FR-ORD-09). */
@Controller('admin/allocations')
@Roles('ADMIN')
export class AdminAllocationsController {
  constructor(private readonly schedule: AllocationScheduleService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list() {
    return this.schedule.schedule();
  }

  @Post(':id/reallocate')
  @Idempotent()
  @HttpCode(200)
  reallocate(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(ReallocateRequestSchema)) body: ReallocateRequest,
  ) {
    return this.schedule.reallocate(actor, id, version, body);
  }
}

@Controller('contributions')
export class ContributionsController {
  constructor(private readonly rfqs: RfqService) {}

  @Put(':id')
  @Roles('HOUSEHOLD')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CreateContributionRequestSchema)) body: CreateContributionRequest,
  ) {
    return this.rfqs.updateContribution(actor, id, version, body);
  }

  @Post(':id/withdraw')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  withdraw(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.withdrawContribution(actor, id, version);
  }
  @Get(':id/history')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD', 'ADMIN')
  history(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.contributionHistory(actor, id);
  }
}

@Controller('direct-quotations')
export class DirectQuotationsController {
  constructor(private readonly rfqs: RfqService) {}

  @Put(':id')
  @Roles('HOUSEHOLD')
  revise(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CreateDirectQuotationRequestSchema))
    body: CreateDirectQuotationRequest,
  ) {
    return this.rfqs.reviseDirectQuotation(actor, id, version, body);
  }

  @Post(':id/withdraw')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  withdraw(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.withdrawDirectQuotation(actor, id, version);
  }
}

@Controller('allocations')
export class AllocationsController {
  constructor(private readonly rfqs: RfqService) {}

  /** GH#11: hộ xác nhận phân bổ PROPOSED của mình. */
  @Post(':id/confirm')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  confirm(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ): Promise<AllocationDto> {
    return this.rfqs.confirmAllocation(actor, id, version);
  }

  /** GH#11: hộ từ chối phân bổ ⇒ hủy cả đơn chưa sản xuất. */
  @Post(':id/decline')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  decline(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ): Promise<AllocationDto> {
    return this.rfqs.declineAllocation(actor, id, version);
  }

  /** GH#11: hộ báo cáo số lượng đã xong trong 0..quantity. */
  @Post(':id/progress')
  @Idempotent()
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  progress(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(ReportProgressRequestSchema)) body: ReportProgressRequest,
  ): Promise<AllocationDto> {
    return this.rfqs.reportProgress(actor, id, version, body);
  }
}
