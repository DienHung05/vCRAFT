import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { Public } from '../../common/auth/auth.guard';
import type { HttpReply } from '../../common/http/http-types';
import { PaymentsService } from './application/payments.service';
import { MomoGateway } from './gateways/momo.gateway';
import type { WebhookVerdict } from './gateways/payment-gateway';
import { VnpayGateway } from './gateways/vnpay.gateway';
import { flatQuery } from './payment-webhooks.controller';
import { paymentsConfig } from './payments.config';

/** The payment a verified return names, also when the provider says it is still in progress. */
function referenceOf(verdict: WebhookVerdict): string | undefined {
  if (!verdict.signatureValid) return undefined;
  return verdict.event ? verdict.event.referenceCode : verdict.referenceCode;
}

/** The browser return waits for the provider's answer at most this long. */
const SYNC_WAIT_MS = 4_000;

/**
 * Where VNPay and MoMo send the buyer's browser back (ADR-0021). It only forwards to the web status page,
 * which polls the payment. The browser return itself never marks anything paid: only the IPN, or the provider's
 * own answer to a status query made here, does. A call whose signature does not verify goes to the buyer's
 * requests instead of a status page and triggers no query.
 */
@Controller('payments/return')
@Public()
export class PaymentReturnController {
  private readonly logger = new Logger('PaymentReturn');

  constructor(
    private readonly payments: PaymentsService,
    private readonly vnpay: VnpayGateway,
    private readonly momo: MomoGateway,
  ) {}

  @Get('vnpay')
  async vnpayReturn(@Query() query: Record<string, unknown>, @Res() reply: HttpReply) {
    const verdict = this.vnpay.verifyCallback(flatQuery(query));
    return this.forward(reply, 'vnpay', referenceOf(verdict));
  }

  @Get('momo')
  async momoReturn(@Query() query: Record<string, unknown>, @Res() reply: HttpReply) {
    const verdict = this.momo.verifyCallback(flatQuery(query));
    return this.forward(reply, 'momo', referenceOf(verdict));
  }

  private async forward(reply: HttpReply, provider: string, referenceCode: string | undefined) {
    const { appUrl } = paymentsConfig();
    // The buyer is back from the provider: ask it for the result now (a few seconds at most), so the status
    // page usually opens already paid even when the IPN is late. The state still comes from the provider.
    if (referenceCode) await this.syncBriefly(referenceCode);
    this.logger.log(
      `${provider} return ${referenceCode ? 'signature ok' : 'signature not verified'}`,
    );
    const target = referenceCode
      ? `${appUrl}/vi/thanh-toan/${encodeURIComponent(referenceCode)}`
      : `${appUrl}/vi/yeu-cau-bao-gia`;
    return reply.status(302).header('Location', target).send(undefined);
  }

  private async syncBriefly(referenceCode: string): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, SYNC_WAIT_MS);
    });
    try {
      await Promise.race([this.payments.syncWithProvider(referenceCode), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
