import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  type AdminPaymentListQuery,
  AdminPaymentListQuerySchema,
  type CreatePaymentRequest,
  CreatePaymentRequestSchema,
  type RecordOfflinePaymentRequest,
  RecordOfflinePaymentRequestSchema,
  type RefundPaymentRequest,
  RefundPaymentRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import { notFound } from '../../common/errors/app-error';
import { IfMatchVersion } from '../../common/http/if-match';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PaymentsService } from './application/payments.service';

/** A payment reference code on the URL; anything else is a 404, like a bad uuid. */
class ReferencePipe {
  transform(value: string): string {
    if (!/^[A-Z0-9]{6,40}$/.test(value)) throw notFound();
    return value;
  }
}

/** The buyer's side of payment (ADR-0021): start a payment of an order, poll it, give it up. */
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** The order's money, its payments and the methods on offer. */
  @Get('orders/:id/payments')
  @Header('Cache-Control', 'private, no-store')
  @Roles('BUYER', 'ADMIN')
  list(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.payments.orderPayments(actor, id);
  }

  @Post('orders/:id/payments')
  @Roles('BUYER')
  create(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(CreatePaymentRequestSchema)) body: CreatePaymentRequest,
    @Req() request: { ip?: string },
  ) {
    return this.payments.create(actor, id, body, request.ip ?? '127.0.0.1');
  }

  /** What the status page polls every few seconds until the payment is final. */
  @Get('payments/:ref')
  @Header('Cache-Control', 'private, no-store')
  @Roles('BUYER', 'ADMIN')
  get(@CurrentActor() actor: Actor, @Param('ref', new ReferencePipe()) ref: string) {
    return this.payments.get(actor, ref);
  }

  @Post('payments/:ref/cancel')
  @HttpCode(200)
  @Roles('BUYER')
  cancel(@CurrentActor() actor: Actor, @Param('ref', new ReferencePipe()) ref: string) {
    return this.payments.cancel(actor, ref);
  }
}

/** The village administration's side of payment: the list, offline balance entry, manual refund. */
@Controller('admin')
@Roles('ADMIN')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new ZodValidationPipe(AdminPaymentListQuerySchema)) query: AdminPaymentListQuery) {
    return this.payments.adminList(query);
  }

  /** Records the balance of an order paid outside the site (cash, another account). Audit-logged. */
  @Post('orders/:id/payments/offline')
  recordOffline(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(RecordOfflinePaymentRequestSchema))
    body: RecordOfflinePaymentRequest,
  ) {
    return this.payments.recordOffline(actor, id, body);
  }

  /** Marks a paid payment refunded with a reason. No gateway is called: the money goes back by hand. */
  @Post('payments/:id/refund')
  @HttpCode(200)
  refund(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(RefundPaymentRequestSchema)) body: RefundPaymentRequest,
  ) {
    return this.payments.refund(actor, id, version, body);
  }

  /** Sandbox only: stands in for the bank and transfers the exact amount of a pending SePay payment. */
  @Post('payments/:id/simulate-transfer')
  @HttpCode(200)
  simulateTransfer(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.payments.simulateTransfer(actor, id);
  }
}
