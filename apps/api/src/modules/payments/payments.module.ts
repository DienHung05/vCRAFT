import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsService } from './application/payments.service';
import { MomoGateway } from './gateways/momo.gateway';
import { PAYMENT_HTTP, type PaymentHttp } from './gateways/payment-gateway';
import { SepayGateway } from './gateways/sepay.gateway';
import { VnpayGateway } from './gateways/vnpay.gateway';
import { PaymentReturnController } from './payment-return.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { AdminPaymentsController, PaymentsController } from './payments.controller';

/** The only outbound call: MoMo's create-payment endpoint. Tests replace this provider with a fake. */
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
    SepayGateway,
    VnpayGateway,
    MomoGateway,
    { provide: PAYMENT_HTTP, useValue: realHttp },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
