import { LockMode, type MikroORM } from '@mikro-orm/core';
import { paymentTransition } from '@vcraft/domain';
import { Notification } from '../entities/notification.entity.js';
import { OutboxEvent } from '../entities/outbox-event.entity.js';
import { Payment } from '../entities/payment.entity.js';

/** Payments past their expiry that are still `PENDING`, oldest first. */
export async function duePaymentIds(
  orm: MikroORM,
  now = new Date(),
  limit = 50,
): Promise<string[]> {
  const rows = await orm.em
    .fork()
    .find(
      Payment,
      { status: 'PENDING', expiresAt: { $lte: now } },
      { fields: ['id'], orderBy: { expiresAt: 'asc' }, limit },
    );
  return rows.map((row) => row.id);
}

export type ExpirePaymentOutcome = 'EXPIRED' | 'UNCHANGED';

/**
 * `payment.expire` for one payment (ADR-0021): a `PENDING` payment past its `expiresAt` becomes `EXPIRED` and the
 * buyer is told. Idempotent: the row lock and the state check mean a retried or duplicated job changes and
 * notifies nothing twice. A transfer that arrives later is still honoured by the webhook (EXPIRED to PAID).
 */
export async function expirePayment(
  orm: MikroORM,
  paymentId: string,
  now = new Date(),
): Promise<ExpirePaymentOutcome> {
  return orm.em.fork().transactional(async (em) => {
    const payment = await em.findOne(Payment, paymentId, {
      lockMode: LockMode.PESSIMISTIC_WRITE,
      populate: ['order.buyer'],
    });
    if (payment?.status !== 'PENDING' || !payment.expiresAt) return 'UNCHANGED';
    const next = paymentTransition('PENDING', 'EXPIRE', {
      actor: 'SYSTEM',
      now,
      expiresAt: payment.expiresAt,
    });
    if (!next.ok) return 'UNCHANGED';
    payment.status = next.value;
    const notice = em.create(Notification, {
      recipientId: payment.order.buyer.id,
      type: 'PAYMENT_EXPIRED',
      subjectId: payment.order.id,
    });
    // The same event the API writes, so the worker mails this notice like any other.
    em.create(OutboxEvent, { type: 'notification.created', payload: { noticeIds: [notice.id] } });
    return 'EXPIRED';
  });
}

/** Expires every payment that is due; returns the outcomes. Run every minute by the worker. */
export async function expireDuePayments(orm: MikroORM, now = new Date()) {
  const outcomes: ExpirePaymentOutcome[] = [];
  for (const id of await duePaymentIds(orm, now)) outcomes.push(await expirePayment(orm, id, now));
  return outcomes;
}
