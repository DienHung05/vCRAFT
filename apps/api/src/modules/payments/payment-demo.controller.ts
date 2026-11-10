import { Body, Controller, Get, Header, HttpCode, Param, Post, Query } from '@nestjs/common';
import { type DemoConfirmRequest, DemoConfirmRequestSchema } from '@vcraft/contracts';
import { Public } from '../../common/auth/auth.guard';
import { notFound } from '../../common/errors/app-error';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DemoPaymentsService } from './application/demo-payments.service';

/** A payment reference code on the URL; anything else is a 404. */
class ReferencePipe {
  transform(value: string): string {
    if (!/^[A-Z0-9]{6,40}$/.test(value)) throw notFound();
    return value;
  }
}

/**
 * The confirm page behind the QR of demo payment mode (ADR-0025). Public, because the person scanning the QR
 * with a phone is not signed in; the per-payment secret in the link is the credential. Unlike the provider IPN,
 * the state change is a POST, and the global rate limit applies to it like to any public route.
 */
@Controller('payments/demo')
@Public()
export class PaymentDemoController {
  constructor(private readonly demo: DemoPaymentsService) {}

  @Get(':ref')
  @Header('Cache-Control', 'private, no-store')
  view(@Param('ref', new ReferencePipe()) ref: string, @Query('k') token: unknown) {
    if (typeof token !== 'string' || token === '') throw notFound();
    return this.demo.view(ref, token);
  }

  @Post(':ref/confirm')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  confirm(
    @Param('ref', new ReferencePipe()) ref: string,
    @Body(new ZodValidationPipe(DemoConfirmRequestSchema)) body: DemoConfirmRequest,
  ) {
    return this.demo.confirm(ref, body.token, body.outcome);
  }
}
