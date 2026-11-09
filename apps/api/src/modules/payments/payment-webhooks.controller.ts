import { Body, Controller, Get, Headers, HttpCode, Logger, Post, Query } from '@nestjs/common';
import { Public } from '../../common/auth/auth.guard';
import { AppError } from '../../common/errors/app-error';
import { PaymentsService, type ReconcileResult } from './application/payments.service';
import { MomoGateway } from './gateways/momo.gateway';
import type { WebhookVerdict } from './gateways/payment-gateway';
import { SepayGateway } from './gateways/sepay.gateway';
import { VnpayGateway } from './gateways/vnpay.gateway';

/** Fastify hands query values as strings or arrays; the providers only ever send single strings. */
export function flatQuery(query: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

/**
 * Provider callbacks (ADR-0021): public, because the provider is not a signed-in user, and checked by the
 * provider's own credentials or signature instead. Each answers fast, applies the event idempotently through
 * `PaymentsService.reconcile` and logs every hit with its signature result.
 */
@Controller('payments/webhooks')
@Public()
export class PaymentWebhooksController {
  private readonly logger = new Logger('PaymentWebhooks');

  constructor(
    private readonly payments: PaymentsService,
    private readonly sepay: SepayGateway,
    private readonly vnpay: VnpayGateway,
    private readonly momo: MomoGateway,
  ) {}

  private async apply(provider: string, verdict: WebhookVerdict): Promise<ReconcileResult | null> {
    if (!verdict.signatureValid) {
      this.logger.warn(`${provider} webhook rejected: ${verdict.reason}`);
      return null;
    }
    if (!verdict.event) {
      this.logger.log(`${provider} webhook ignored: ${verdict.ignored}`);
      return { outcome: 'UNKNOWN_REFERENCE', paymentId: null };
    }
    const result = await this.payments.reconcile(verdict.event);
    this.logger.log(
      `${provider} webhook signature ok, ref ${verdict.event.referenceCode} txn ${verdict.event.providerTxnId}: ${result.outcome}`,
    );
    return result;
  }

  /** SePay bank-account webhook: one POST per transfer; answers `{"success": true}` within seconds. */
  @Post('sepay')
  @HttpCode(200)
  async sepayWebhook(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    const result = await this.apply('sepay', this.sepay.verifyCallback({ authorization, body }));
    if (!result) throw new AppError('PAYMENT_WEBHOOK_REJECTED');
    return { success: true };
  }

  /** VNPay IPN (a GET with the signed `vnp_*` query); answers with VNPay's `RspCode` envelope. */
  @Get('vnpay')
  async vnpayIpn(@Query() query: Record<string, unknown>) {
    let result: ReconcileResult | null;
    try {
      result = await this.apply('vnpay', this.vnpay.verifyCallback(flatQuery(query)));
    } catch (error) {
      this.logger.error(error);
      return { RspCode: '99', Message: 'Unknown error' };
    }
    if (!result) return { RspCode: '97', Message: 'Invalid signature' };
    switch (result.outcome) {
      case 'UNKNOWN_REFERENCE':
        return { RspCode: '01', Message: 'Order not found' };
      case 'AMOUNT_MISMATCH':
        return { RspCode: '04', Message: 'Invalid amount' };
      case 'DUPLICATE':
      case 'ALREADY_SETTLED':
        return { RspCode: '02', Message: 'Order already confirmed' };
      default:
        return { RspCode: '00', Message: 'Confirm Success' };
    }
  }

  /** MoMo IPN: a signed JSON body; MoMo wants an HTTP 204 once the call is handled. */
  @Post('momo')
  @HttpCode(204)
  async momoIpn(@Body() body: Record<string, unknown>) {
    const result = await this.apply('momo', this.momo.verifyCallback(body ?? {}));
    if (!result) throw new AppError('PAYMENT_WEBHOOK_REJECTED');
  }
}
