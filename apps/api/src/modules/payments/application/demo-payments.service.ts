import { createHash, timingSafeEqual } from 'node:crypto';
import { MikroORM } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import type { DemoPaymentViewDto } from '@vcraft/contracts';
import { Payment } from '@vcraft/database';
import { notFound } from '../../../common/errors/app-error';
import { paymentsConfig } from '../payments.config';
import { PaymentsService } from './payments.service';

/** Constant-time comparison that does not leak the length of the secret. */
function sameToken(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** The secret of a demo checkout: the `k` of its confirm link. */
function tokenOf(confirmUrl: string): string | null {
  try {
    return new URL(confirmUrl).searchParams.get('k');
  } catch {
    return null;
  }
}

/**
 * The confirm page behind the QR of demo payment mode (ADR-0025). Public: whoever holds the link holds the
 * per-payment secret, and that is accepted because no money moves. Everything is a 404 unless demo mode is on,
 * the payment exists, its checkout is a demo one and the secret matches. A confirmation goes through the same
 * `PaymentsService.reconcile` as a provider event, marked `{ demo: true }` on the payment.
 */
@Injectable()
export class DemoPaymentsService {
  private readonly logger = new Logger('DemoPayments');

  constructor(
    private readonly orm: MikroORM,
    private readonly payments: PaymentsService,
  ) {}

  async view(referenceCode: string, token: string): Promise<DemoPaymentViewDto> {
    const payment = await this.find(referenceCode, token);
    this.logger.log(`demo view ref ${referenceCode}`);
    return toView(payment);
  }

  /** Idempotent: a payment that is no longer pending (or has run out of time) just answers its current state. */
  async confirm(
    referenceCode: string,
    token: string,
    outcome: 'PAID' | 'FAILED',
  ): Promise<DemoPaymentViewDto> {
    const payment = await this.find(referenceCode, token);
    const open = payment.status === 'PENDING' && (payment.expiresAt?.getTime() ?? 0) > Date.now();
    if (open && payment.provider) {
      const result = await this.payments.reconcile({
        provider: payment.provider,
        referenceCode,
        providerTxnId: `DEMO-${referenceCode}`,
        amountVnd: payment.amountVnd,
        outcome,
        raw: { demo: true, source: 'demo-confirm' },
      });
      this.logger.log(`demo confirm ref ${referenceCode} outcome ${outcome}: ${result.outcome}`);
    } else {
      this.logger.log(
        `demo confirm ref ${referenceCode} outcome ${outcome}: nothing to do, payment is ${payment.status}`,
      );
    }
    return toView(await this.load(referenceCode));
  }

  private async load(referenceCode: string): Promise<Payment> {
    const payment = await this.orm.em.fork().findOne(Payment, { referenceCode });
    if (!payment) throw notFound();
    return payment;
  }

  private async find(referenceCode: string, token: string): Promise<Payment> {
    const reject = (reason: string) => {
      this.logger.warn(`demo link refused for ref ${referenceCode}: ${reason}`);
      return notFound();
    };
    if (!paymentsConfig().demo) throw reject('demo mode is off');
    const payment = await this.orm.em.fork().findOne(Payment, { referenceCode });
    if (payment?.checkout?.type !== 'DEMO') throw reject('no demo payment');
    const expected = tokenOf(payment.checkout.confirmUrl);
    if (!expected || !sameToken(token, expected)) throw reject('wrong token');
    return payment;
  }
}

function toView(payment: Payment): DemoPaymentViewDto {
  const timedOut =
    payment.status === 'PENDING' && (payment.expiresAt?.getTime() ?? 0) <= Date.now();
  return {
    referenceCode: payment.referenceCode,
    amountVnd: payment.amountVnd,
    method: payment.method as DemoPaymentViewDto['method'],
    kind: payment.kind,
    status: timedOut ? 'EXPIRED' : payment.status,
    expiresAt: payment.expiresAt?.toISOString() ?? null,
  };
}
