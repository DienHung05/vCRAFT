import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Res } from '@nestjs/common';
import {
  type CreateContributionRequest,
  CreateContributionRequestSchema,
  type CreateCooperativeQuotationRequest,
  CreateCooperativeQuotationRequestSchema,
  type CreateRfqRequest,
  CreateRfqRequestSchema,
  formatVersionTag,
  InviteHouseholdsRequestSchema,
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
