import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Public } from '../../common/auth/auth.guard';
import type { HttpReply } from '../../common/http/http-types';
import { MomoGateway } from './gateways/momo.gateway';
import { VnpayGateway } from './gateways/vnpay.gateway';
import { flatQuery } from './payment-webhooks.controller';
import { paymentsConfig } from './payments.config';

/**
 * Where VNPay and MoMo send the buyer's browser back (ADR-0021). It only forwards to the web status page,
 * which polls the payment: the browser return never marks anything paid, that is the IPN's job. A call whose
 * signature does not verify goes to the buyer's requests instead of a status page.
 */
@Controller('payments/return')
@Public()
export class PaymentReturnController {
  private readonly logger = new Logger('PaymentReturn');

  constructor(
    private readonly vnpay: VnpayGateway,
    private readonly momo: MomoGateway,
  ) {}

  @Get('vnpay')
  vnpayReturn(@Query() query: Record<string, unknown>, @Res() reply: HttpReply) {
    const verdict = this.vnpay.verifyCallback(flatQuery(query));
    return this.forward(reply, 'vnpay', verdict.signatureValid && verdict.event?.referenceCode);
  }

  @Get('momo')
  momoReturn(@Query() query: Record<string, unknown>, @Res() reply: HttpReply) {
    const verdict = this.momo.verifyCallback(flatQuery(query));
    return this.forward(reply, 'momo', verdict.signatureValid && verdict.event?.referenceCode);
  }

  private forward(reply: HttpReply, provider: string, referenceCode: string | false | undefined) {
    const { appUrl } = paymentsConfig();
    this.logger.log(
      `${provider} return ${referenceCode ? 'signature ok' : 'signature not verified'}`,
    );
    const target = referenceCode
      ? `${appUrl}/vi/thanh-toan/${encodeURIComponent(referenceCode)}`
      : `${appUrl}/vi/yeu-cau-bao-gia`;
    return reply.status(302).header('Location', target).send(undefined);
  }
}
