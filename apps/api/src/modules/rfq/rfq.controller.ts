import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
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
  type CreateRfqRequest,
  CreateRfqRequestSchema,
  formatVersionTag,
  InviteHouseholdsRequestSchema,
  type ReportProgressRequest,
  ReportProgressRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import type { HttpReply } from '../../common/http/http-types';
import { IfMatchVersion } from '../../common/http/if-match';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RfqService } from './application/rfq.service';

@Controller('rfqs')
export class RfqController {
  constructor(private readonly rfqs: RfqService) {}

  @Post()
  @Roles('BUYER')
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateRfqRequestSchema)) body: CreateRfqRequest,
  ) {
    return this.rfqs.createRequest(actor, body);
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

  @Post(':id/contributions')
  @Roles('HOUSEHOLD')
  createContribution(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(CreateContributionRequestSchema)) body: CreateContributionRequest,
  ) {
    return this.rfqs.createContribution(actor, id, body);
  }

  @Get(':id/contributions')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD', 'ADMIN')
  listContributions(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.rfqs.listContributions(actor, id);
  }

  @Post(':id/quotations')
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
  @HttpCode(200)
  @Roles('BUYER', 'ADMIN')
  receive(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.rfqs.confirmReceipt(actor, id, version);
  }

  /** GH#11: admin dieu phoi huy don sau san xuat. Ly do bat buoc. */
  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('ADMIN')
  cancel(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(CancelOrderRequestSchema)) body: CancelOrderRequest,
  ) {
    return this.rfqs.cancelOrder(actor, id, version, body.reason);
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

@Controller('allocations')
export class AllocationsController {
  constructor(private readonly rfqs: RfqService) {}

  /** GH#11: hộ xác nhận phân bổ PROPOSED của mình. */
  @Post(':id/confirm')
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
  @HttpCode(200)
  @Roles('HOUSEHOLD')
  progress(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(ReportProgressRequestSchema)) body: ReportProgressRequest,
  ): Promise<AllocationDto> {
    return this.rfqs.reportProgress(actor, id, version, body.completedQty);
  }
}
