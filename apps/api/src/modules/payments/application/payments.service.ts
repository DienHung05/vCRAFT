import { randomBytes } from 'node:crypto';
import { type EntityManager, LockMode, MikroORM } from '@mikro-orm/core';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminPaymentDto,
  AdminPaymentListQuery,
  AdminPaymentPageDto,
  CreatePaymentRequest,
  OrderPaymentsDto,
  PaymentDto,
  RecordOfflinePaymentRequest,
  RefundPaymentRequest,
} from '@vcraft/contracts';
import {
  AppUser,
  AuditLog,
  CooperativeQuotation,
  Payment,
  QuotationRequest,
} from '@vcraft/database';
import {
  newReferenceCode,
  type PaymentKind,
  paymentAmountVnd,
  paymentEligibility,
  paymentTransition,
  providerOf,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion, unwrap } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { NotificationPublisher } from '../../notifications/application/notification-publisher';
import { MomoGateway } from '../gateways/momo.gateway';
import type {
  PaymentGateway,
  PaymentSnapshot,
  VerifiedPaymentEvent,
} from '../gateways/payment-gateway';
import { SepayGateway } from '../gateways/sepay.gateway';
import { VnpayGateway } from '../gateways/vnpay.gateway';
import { availableMethods, paymentsConfig } from '../payments.config';
import { toPaymentDto } from './payment-view';

/** The system is the actor of provider-driven changes; nobody is excluded from its notices. */
const SYSTEM_ACTOR = 'system';

export type ReconcileOutcome =
  | 'PAID'
  | 'FAILED'
  /** The provider event was already applied (same transaction id). */
  | 'DUPLICATE'
  | 'UNKNOWN_REFERENCE'
  | 'AMOUNT_MISMATCH'
  /** The payment is cancelled or failed, or the order already has a paid payment of this kind. */
  | 'NOT_APPLIED'
  | 'ALREADY_SETTLED';

export interface ReconcileResult {
  outcome: ReconcileOutcome;
  paymentId: string | null;
}

interface CursorValue {
  t: string;
  id: string;
}

function decodeCursor(raw: string): CursorValue {
  try {
    const value = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<CursorValue>;
    if (
      typeof value.t === 'string' &&
      typeof value.id === 'string' &&
      !Number.isNaN(Date.parse(value.t))
    )
      return { t: value.t, id: value.id };
  } catch {
    // Falls through to the error below.
  }
  throw new AppError('VALIDATION_MALFORMED_REQUEST', 'cursor is not valid');
}

const randomSource = (length: number) => new Uint8Array(randomBytes(length));

/**
 * Online payment of orders (ADR-0021, GH#205). An order is an accepted quotation, identified by its quotation
 * request. All money changes go through the payment state machine of `@vcraft/domain`; a payment becomes `PAID`
 * only from a verified provider event (`reconcile`) or an administrator's offline entry, never from the browser.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly orm: MikroORM,
    private readonly publisher: NotificationPublisher,
    private readonly sepay: SepayGateway,
    private readonly vnpay: VnpayGateway,
    private readonly momo: MomoGateway,
  ) {}

  // --- reads ---

  /** The order's money, its payments and the methods on offer. Buyer of the order, or any administrator. */
  async orderPayments(actor: Actor, requestId: string): Promise<OrderPaymentsDto> {
    const em = this.orm.em.fork();
    const request = await this.order(em, requestId);
    this.assertCanRead(actor, request);
    const quotation = await this.acceptedQuotation(em, request);
    const payments = await em.find(
      Payment,
      { order: request },
      { populate: ['order'], orderBy: { createdAt: 'desc', id: 'desc' } },
    );
    const config = paymentsConfig();
    const paidDeposit = payments.find((p) => p.kind === 'DEPOSIT' && p.status === 'PAID');
    const paidBalance = payments.find((p) => p.kind === 'BALANCE' && p.status === 'PAID');
    return {
      orderId: request.id,
      totalVnd: quotation.totalVnd,
      depositPercent: config.depositPercent,
      depositAmountVnd: paymentAmountVnd(
        'DEPOSIT',
        quotation.totalVnd,
        config.depositPercent,
        paidDeposit?.amountVnd,
      ),
      balanceAmountVnd: paymentAmountVnd(
        'BALANCE',
        quotation.totalVnd,
        config.depositPercent,
        paidDeposit?.amountVnd,
      ),
      depositRequired: config.depositRequired,
      depositPaidAt: paidDeposit?.paidAt?.toISOString() ?? null,
      balancePaidAt: paidBalance?.paidAt?.toISOString() ?? null,
      methods: availableMethods(config),
      simulateAvailable: config.sandbox && config.sepay !== null,
      payments: payments.map(toPaymentDto),
    };
  }

  /** One payment by its reference code: what the buyer's status page polls. */
  async get(actor: Actor, referenceCode: string): Promise<PaymentDto> {
    const em = this.orm.em.fork();
    const payment = await em.findOne(
      Payment,
      { referenceCode },
      { populate: ['order', 'order.buyer'] },
    );
    if (!payment) throw notFound();
    this.assertCanRead(actor, payment.order);
    return toPaymentDto(payment);
  }

  async adminList(query: AdminPaymentListQuery): Promise<AdminPaymentPageDto> {
    const em = this.orm.em.fork();
    const where: Record<string, unknown>[] = [];
    if (query.status) where.push({ status: query.status });
    if (query.method) where.push({ method: query.method });
    if (query.kind) where.push({ kind: query.kind });
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const at = new Date(cursor.t);
      where.push({ $or: [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: cursor.id } }] });
    }
    const rows = await em.find(
      Payment,
      { $and: where },
      {
        populate: ['order', 'order.buyer'],
        orderBy: { createdAt: 'desc', id: 'desc' },
        limit: query.limit + 1,
      },
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map(
        (payment): AdminPaymentDto => ({
          ...toPaymentDto(payment),
          orderTitle: payment.order.title ?? null,
          buyerName: payment.order.buyer.fullName ?? payment.order.buyer.email,
        }),
      ),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({
                t: last.createdAt.toISOString(),
                id: last.id,
              } satisfies CursorValue),
            ).toString('base64url')
          : null,
    };
  }

  // --- buyer writes ---

  /**
   * The buyer starts a payment of the order (a deposit before production, the balance later). A pending
   * payment of the same kind and method is returned as it is; with another method it is cancelled and replaced.
   */
  async create(
    actor: Actor,
    requestId: string,
    input: CreatePaymentRequest,
    clientIp: string,
  ): Promise<PaymentDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.order(em, requestId, true);
      if (actor.role !== 'BUYER' || request.buyer.id !== actor.id) throw notFound();
      if (actor.locked) throw forbidden();
      const config = paymentsConfig();
      if (!availableMethods(config).includes(input.method)) {
        throw new AppError('PAYMENT_METHOD_UNAVAILABLE', input.method);
      }
      const quotation = await this.acceptedQuotation(em, request);
      const payments = await em.find(Payment, { order: request }, { populate: ['order'] });
      const state = this.settled(payments);
      const blocked = paymentEligibility({
        kind: input.kind,
        requestStatus: request.status,
        depositPaid: state.deposit !== undefined,
        balancePaid: state.balance !== undefined,
        depositRequired: config.depositRequired,
      });
      if (blocked) throw blocked;

      const now = new Date();
      for (const pending of payments.filter(
        (p) => p.kind === input.kind && p.status === 'PENDING',
      )) {
        const reusable =
          pending.method === input.method && (pending.expiresAt?.getTime() ?? 0) > now.getTime();
        if (reusable) return toPaymentDto(pending);
        // A payment past its time is expired by the system; one the buyer replaces is cancelled by the buyer.
        const expired = (pending.expiresAt?.getTime() ?? 0) <= now.getTime();
        pending.status = unwrap(
          expired
            ? paymentTransition('PENDING', 'EXPIRE', {
                actor: 'SYSTEM',
                now,
                expiresAt: pending.expiresAt ?? now,
              })
            : paymentTransition('PENDING', 'CANCEL', { actor: 'BUYER_OWNER' }),
        );
      }

      const payment = em.create(Payment, {
        order: request,
        kind: input.kind,
        method: input.method,
        provider: providerOf(input.method),
        amountVnd: paymentAmountVnd(
          input.kind,
          quotation.totalVnd,
          config.depositPercent,
          state.deposit?.amountVnd,
        ),
        referenceCode: await this.freshReference(em),
        expiresAt: new Date(now.getTime() + config.expiryMs),
      });
      const snapshot: PaymentSnapshot = {
        id: payment.id,
        referenceCode: payment.referenceCode,
        kind: payment.kind,
        amountVnd: payment.amountVnd,
        expiresAt: payment.expiresAt as Date,
        description: `vCraft ${payment.referenceCode}`,
        clientIp,
      };
      try {
        payment.checkout = await this.gatewayFor(input.method).createCheckout(snapshot);
      } catch (error) {
        this.logger.warn(
          `payment ${payment.referenceCode} (${input.method}) could not be started: ${error instanceof Error ? error.message : error}`,
        );
        throw new AppError('SERVICE_UNAVAILABLE', 'The payment provider did not answer');
      }
      await em.flush();
      return toPaymentDto(payment);
    });
  }

  /** The buyer gives up a pending payment (to pick another method, for instance). */
  async cancel(actor: Actor, referenceCode: string): Promise<PaymentDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const payment = await em.findOne(
        Payment,
        { referenceCode },
        { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['order', 'order.buyer'] },
      );
      if (!payment || actor.role !== 'BUYER' || payment.order.buyer.id !== actor.id)
        throw notFound();
      if (actor.locked) throw forbidden();
      payment.status = unwrap(
        paymentTransition(payment.status, 'CANCEL', { actor: 'BUYER_OWNER' }),
      );
      await em.flush();
      return toPaymentDto(payment);
    });
  }

  // --- provider events ---

  /**
   * Applies one verified provider event to the payment it names (ADR-0021 rules): matched by reference code and
   * exact amount, idempotent on the provider's transaction id, under a row lock. Never throws for a payment that
   * cannot take the event: the webhook still answers success so the provider stops retrying, and the outcome
   * says what happened.
   */
  async reconcile(event: VerifiedPaymentEvent, now = new Date()): Promise<ReconcileResult> {
    return this.orm.em.fork().transactional(async (em) => {
      const payment = await em.findOne(
        Payment,
        { referenceCode: event.referenceCode },
        { lockMode: LockMode.PESSIMISTIC_WRITE, populate: ['order', 'order.buyer'] },
      );
      if (!payment || payment.provider !== event.provider) {
        return { outcome: 'UNKNOWN_REFERENCE', paymentId: null };
      }
      const seen =
        event.outcome === 'PAID'
          ? await em.findOne(Payment, {
              provider: event.provider,
              providerTxnId: event.providerTxnId,
            })
          : null;
      if (seen) return { outcome: 'DUPLICATE', paymentId: payment.id };

      const record = (extra: Record<string, unknown> = {}) => {
        payment.rawLastEvent = { ...event.raw, receivedAt: now.toISOString(), ...extra };
      };

      if (event.outcome === 'FAILED') {
        if (payment.status !== 'PENDING') return { outcome: 'NOT_APPLIED', paymentId: payment.id };
        payment.status = unwrap(paymentTransition('PENDING', 'FAIL', { actor: 'SYSTEM' }));
        record();
        return { outcome: 'FAILED', paymentId: payment.id };
      }

      if (payment.status === 'PAID' || payment.status === 'REFUNDED') {
        return { outcome: 'ALREADY_SETTLED', paymentId: payment.id };
      }
      if (payment.status !== 'PENDING' && payment.status !== 'EXPIRED') {
        record({ unapplied: `payment is ${payment.status}` });
        this.logger.warn(
          `transfer ${event.providerTxnId} hit ${payment.status} payment ${payment.referenceCode}`,
        );
        return { outcome: 'NOT_APPLIED', paymentId: payment.id };
      }
      const confirmed = paymentTransition(payment.status, 'CONFIRM', {
        actor: 'SYSTEM',
        expectedAmountVnd: payment.amountVnd,
        receivedAmountVnd: event.amountVnd,
      });
      if (!confirmed.ok) {
        record({
          mismatch: { expectedAmountVnd: payment.amountVnd, receivedAmountVnd: event.amountVnd },
        });
        this.logger.warn(
          `payment ${payment.referenceCode}: received ${event.amountVnd}, expected ${payment.amountVnd}`,
        );
        return { outcome: 'AMOUNT_MISMATCH', paymentId: payment.id };
      }
      const twin = await em.count(Payment, {
        order: payment.order,
        kind: payment.kind,
        status: 'PAID',
        id: { $ne: payment.id },
      });
      if (twin > 0) {
        record({ unapplied: 'the order already has a paid payment of this kind' });
        this.logger.warn(
          `payment ${payment.referenceCode}: order already paid, needs a manual refund`,
        );
        return { outcome: 'NOT_APPLIED', paymentId: payment.id };
      }
      payment.status = confirmed.value;
      payment.paidAt = now;
      payment.providerTxnId = event.providerTxnId;
      record();
      await this.notifyPaid(em, payment, SYSTEM_ACTOR);
      return { outcome: 'PAID', paymentId: payment.id };
    });
  }

  // --- administration ---

  /** An administrator records a balance paid outside the site. Audit-logged; the buyer is told. */
  async recordOffline(
    actor: Actor,
    requestId: string,
    input: RecordOfflinePaymentRequest,
  ): Promise<PaymentDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const request = await this.order(em, requestId, true);
      if (actor.locked) throw forbidden();
      const config = paymentsConfig();
      const quotation = await this.acceptedQuotation(em, request);
      const payments = await em.find(Payment, { order: request }, { populate: ['order'] });
      const state = this.settled(payments);
      const blocked = paymentEligibility({
        kind: 'BALANCE',
        requestStatus: request.status,
        depositPaid: state.deposit !== undefined,
        balancePaid: state.balance !== undefined,
        // The administrator may settle a balance by hand whatever happened to the deposit.
        depositRequired: false,
      });
      if (blocked) throw blocked;

      const now = new Date();
      // An online balance payment still waiting would let the buyer pay twice.
      for (const pending of payments.filter(
        (p) => p.kind === 'BALANCE' && p.status === 'PENDING',
      )) {
        pending.status = unwrap(paymentTransition('PENDING', 'CANCEL', { actor: 'ADMIN' }));
      }
      const amountVnd = paymentAmountVnd(
        'BALANCE',
        quotation.totalVnd,
        config.depositPercent,
        state.deposit?.amountVnd,
      );
      const payment = em.create(Payment, {
        order: request,
        kind: 'BALANCE',
        method: 'OFFLINE',
        provider: null,
        amountVnd,
        referenceCode: await this.freshReference(em),
        expiresAt: null,
        recordedBy: actor.id,
        note: input.note,
      });
      payment.status = unwrap(
        paymentTransition('PENDING', 'CONFIRM', {
          actor: 'ADMIN',
          expectedAmountVnd: amountVnd,
          receivedAmountVnd: amountVnd,
        }),
      );
      payment.paidAt = now;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'payment.record_offline',
        entity: 'payment',
        entityId: payment.id,
        before: null,
        after: {
          orderId: request.id,
          kind: payment.kind,
          amountVnd,
          referenceCode: payment.referenceCode,
          note: input.note,
        },
      });
      await this.notifyPaid(em, payment, actor.id);
      await em.flush();
      return toPaymentDto(payment);
    });
  }

  /** An administrator marks a paid payment refunded. Records the state and the reason; no gateway is called. */
  async refund(
    actor: Actor,
    paymentId: string,
    version: number,
    input: RefundPaymentRequest,
  ): Promise<PaymentDto> {
    return this.orm.em.fork().transactional(async (em) => {
      const payment = await em.findOne(Payment, paymentId, {
        lockMode: LockMode.PESSIMISTIC_WRITE,
        populate: ['order', 'order.buyer'],
      });
      if (!payment) throw notFound();
      if (actor.locked) throw forbidden();
      assertVersion(payment, version);
      const before = payment.status;
      payment.status = unwrap(
        paymentTransition(payment.status, 'REFUND', { actor: 'ADMIN', reason: input.reason }),
      );
      payment.refundedAt = new Date();
      payment.refundedBy = actor.id;
      payment.refundReason = input.reason;
      em.create(AuditLog, {
        actorId: actor.id,
        action: 'payment.refund',
        entity: 'payment',
        entityId: payment.id,
        before: { status: before },
        after: {
          status: payment.status,
          reason: input.reason,
          orderId: payment.order.id,
          kind: payment.kind,
          amountVnd: payment.amountVnd,
        },
      });
      this.publisher.publish(em, {
        type: 'PAYMENT_REFUNDED',
        subjectId: payment.order.id,
        actorId: actor.id,
        recipientIds: [payment.order.buyer.id],
      });
      await em.flush();
      return toPaymentDto(payment);
    });
  }

  /**
   * Sandbox only (`APP_ENV` is not `production`): an administrator stands in for the bank and "transfers" the
   * exact amount of a pending SePay payment. It goes through the same reconciliation as a real webhook.
   */
  async simulateTransfer(actor: Actor, paymentId: string): Promise<PaymentDto> {
    const config = paymentsConfig();
    if (!config.sandbox || !config.sepay) throw new AppError('PAYMENT_METHOD_UNAVAILABLE');
    const em = this.orm.em.fork();
    const payment = await em.findOne(Payment, paymentId, { populate: ['order'] });
    if (!payment) throw notFound();
    if (payment.method !== 'SEPAY_TRANSFER' || payment.status !== 'PENDING') {
      throw new AppError('INVALID_TRANSITION');
    }
    const txnId = `SIM-${payment.referenceCode}-${Date.now()}`;
    const result = await this.reconcile({
      provider: 'SEPAY',
      referenceCode: payment.referenceCode,
      providerTxnId: txnId,
      amountVnd: payment.amountVnd,
      outcome: 'PAID',
      raw: { id: txnId, simulated: true, content: payment.referenceCode },
    });
    const audit = this.orm.em.fork();
    audit.create(AuditLog, {
      actorId: actor.id,
      action: 'payment.simulate_transfer',
      entity: 'payment',
      entityId: payment.id,
      before: { status: payment.status },
      after: { outcome: result.outcome, referenceCode: payment.referenceCode },
    });
    await audit.flush();
    return this.getById(paymentId);
  }

  // --- helpers ---

  private async getById(id: string): Promise<PaymentDto> {
    const payment = await this.orm.em.fork().findOneOrFail(Payment, id, { populate: ['order'] });
    return toPaymentDto(payment);
  }

  private gatewayFor(
    method: CreatePaymentRequest['method'],
  ): Pick<PaymentGateway<unknown>, 'createCheckout'> {
    switch (method) {
      case 'SEPAY_TRANSFER':
        return this.sepay;
      case 'VNPAY':
        return this.vnpay;
      case 'MOMO':
        return this.momo;
    }
  }

  private async order(em: EntityManager, id: string, lock = false) {
    const request = await em.findOne(QuotationRequest, id, {
      populate: ['buyer'],
      ...(lock && { lockMode: LockMode.PESSIMISTIC_WRITE }),
    });
    if (!request) throw notFound();
    return request;
  }

  private assertCanRead(actor: Actor, request: QuotationRequest) {
    const owner = actor.role === 'BUYER' && request.buyer.id === actor.id;
    if (!owner && actor.role !== 'ADMIN') throw notFound();
  }

  private async acceptedQuotation(em: EntityManager, request: QuotationRequest) {
    const quotation = await em.findOne(CooperativeQuotation, { request, status: 'ACCEPTED' });
    if (!quotation) throw notFound();
    return quotation;
  }

  /** The paid deposit and balance of an order, if any. */
  private settled(payments: readonly Payment[]) {
    const paid = (kind: PaymentKind) =>
      payments.find((p) => p.kind === kind && p.status === 'PAID');
    return { deposit: paid('DEPOSIT'), balance: paid('BALANCE') };
  }

  private async freshReference(em: EntityManager): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newReferenceCode(randomSource);
      if ((await em.count(Payment, { referenceCode: code })) === 0) return code;
    }
    throw new Error('could not generate a unique payment reference');
  }

  /** Tells the buyer, and the village board of the order, that money arrived. */
  private async notifyPaid(em: EntityManager, payment: Payment, actorId: string) {
    const request = payment.order;
    const board = request.coordinatorId
      ? [request.coordinatorId]
      : (await em.find(AppUser, { role: 'ADMIN', status: 'ACTIVE' }, { fields: ['id'] })).map(
          (admin) => admin.id,
        );
    this.publisher.publish(em, {
      type: 'PAYMENT_PAID',
      subjectId: request.id,
      actorId,
      recipientIds: [request.buyer.id, ...board],
    });
  }
}
