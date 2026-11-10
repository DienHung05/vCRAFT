import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentProviderSyncService } from './application/payment-provider-sync.service';
import { PaymentsService } from './application/payments.service';
import { MomoGateway } from './gateways/momo.gateway';
import { PAYMENT_HTTP, type PaymentHttp } from './gateways/payment-gateway';
import { SepayGateway } from './gateways/sepay.gateway';
import { VnpayGateway } from './gateways/vnpay.gateway';
import { PaymentReturnController } from './payment-return.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { describePaymentsConfig, paymentsConfig, paymentsConfigIssues } from './payments.config';
import { AdminPaymentsController, PaymentsController } from './payments.controller';

/** The only outbound calls: VNPay and MoMo (create and status query). Tests replace this provider with a fake. */
const realHttp: PaymentHttp = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });

@Module({
  imports: [NotificationsModule, IdempotencyModule],
  controllers: [
    PaymentsController,
    AdminPaymentsController,
    PaymentWebhooksController,
    PaymentReturnController,
  ],
  providers: [
    PaymentsService,
    PaymentProviderSyncService,
    SepayGateway,
    VnpayGateway,
    MomoGateway,
    { provide: PAYMENT_HTTP, useValue: realHttp },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule implements OnModuleInit {
  private readonly logger = new Logger('Payments');

  /** Once at boot: what is on and in which mode, and whatever stops a method from working (no secrets). */
  onModuleInit(): void {
    for (const issue of paymentsConfigIssues()) this.logger.warn(issue);
    this.logger.log(describePaymentsConfig(paymentsConfig()));
  }
}
