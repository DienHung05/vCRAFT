import { MikroORM } from '@mikro-orm/core';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Payment } from '@vcraft/database';
import type { PaymentProvider } from '@vcraft/domain';
import { paymentsConfig } from '../payments.config';
import { LATE_MONEY_WINDOW_MS, PaymentsService } from './payments.service';

/** A pending payment younger than this still has its IPN on the way. */
const MIN_AGE_MS = 2 * 60_000;
const BATCH_SIZE = 25;
const DEFAULT_EVERY_SECONDS = 120;

/**
 * Safety net for a missed VNPay or MoMo IPN (ADR-0024): every couple of minutes it asks the provider about the
 * payments that are still pending or expired within the late-money window, and settles the ones the provider
 * says are paid or failed. It lives in the API because only the API holds the gateway secrets; the worker's
 * `payment.expire-sweep` stays as it is. `PAYMENTS_PROVIDER_SYNC_EVERY_SECONDS=0` turns it off; it is also off
 * under `NODE_ENV=test`.
 */
@Injectable()
export class PaymentProviderSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentProviderSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly orm: MikroORM,
    private readonly payments: PaymentsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    const raw = process.env.PAYMENTS_PROVIDER_SYNC_EVERY_SECONDS?.trim();
    const seconds = raw ? Number(raw) : DEFAULT_EVERY_SECONDS;
    const every = Number.isFinite(seconds) && seconds >= 0 ? seconds : DEFAULT_EVERY_SECONDS;
    if (every === 0) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, every * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One sweep; returns how many payments were asked about. Skips itself while a previous sweep still runs. */
  async runOnce(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const config = paymentsConfig();
      const providers: PaymentProvider[] = [];
      if (config.vnpay) providers.push('VNPAY');
      if (config.momo) providers.push('MOMO');
      if (providers.length === 0) return 0;
      const due = await this.orm.em.fork().find(
        Payment,
        {
          provider: { $in: providers },
          $or: [
            { status: 'PENDING', createdAt: { $lte: new Date(now.getTime() - MIN_AGE_MS) } },
            {
              status: 'EXPIRED',
              expiresAt: { $gte: new Date(now.getTime() - LATE_MONEY_WINDOW_MS) },
            },
          ],
        },
        { orderBy: { createdAt: 'asc' }, limit: BATCH_SIZE, fields: ['id', 'referenceCode'] },
      );
      for (const payment of due) await this.payments.syncWithProvider(payment.referenceCode, now);
      return due.length;
    } catch (error) {
      this.logger.warn(`provider sync failed: ${error instanceof Error ? error.message : error}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
