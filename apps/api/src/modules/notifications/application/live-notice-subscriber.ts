import {
  ChangeSetType,
  type EventSubscriber,
  type FlushEventArgs,
  MikroORM,
  type TransactionEventArgs,
  type UnitOfWork,
} from '@mikro-orm/core';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Notification, QuotationNotice } from '@vcraft/database';
import { LiveSignal } from './live-signal';

/** The transaction object MikroORM hands to flush and transaction events (a Kysely transaction). */
type TransactionKey = object;

/**
 * Wakes the live streams once a new `Notification` or `QuotationNotice` is committed (GH#537).
 *
 * MikroORM semantics (7.2, checked in `UnitOfWork.doCommit` and `AbstractSqlConnection.commit`):
 * - `onFlush` runs after the change sets are computed and before any SQL, so that is where new rows are seen.
 * - `afterFlush` runs after the flush's own implicit transaction has committed, but when the caller owns
 *   the transaction (`em.transactional`, `em.begin`) it runs BEFORE that transaction commits. So with an
 *   open transaction the recipients wait for `afterTransactionCommit` and are dropped on rollback.
 * - A nested `em.transactional` is a savepoint: releasing it is not a commit. Its recipients are dropped
 *   (fail safe): the stream's 3 s poll still delivers them.
 */
@Injectable()
export class LiveNoticeSubscriber implements EventSubscriber, OnModuleInit {
  /** New recipients of the flush in progress, per unit of work; overwritten on each flush so a failed one leaves nothing behind. */
  private readonly flushing = new WeakMap<UnitOfWork, Set<string>>();
  /** Recipients written inside a still-open transaction. */
  private readonly inTransaction = new WeakMap<TransactionKey, Set<string>>();

  constructor(
    private readonly orm: MikroORM,
    private readonly signal: LiveSignal,
  ) {}

  onModuleInit(): void {
    this.orm.em.getEventManager().registerSubscriber(this);
  }

  onFlush({ uow }: FlushEventArgs): void {
    const recipients = new Set<string>();
    for (const changeSet of uow.getChangeSets()) {
      if (changeSet.type !== ChangeSetType.CREATE) continue;
      const entity = changeSet.entity;
      if (entity instanceof Notification || entity instanceof QuotationNotice) {
        recipients.add(entity.recipientId);
      }
    }
    this.flushing.set(uow, recipients);
  }

  afterFlush({ em, uow }: FlushEventArgs): void {
    const recipients = this.flushing.get(uow);
    this.flushing.delete(uow);
    if (!recipients || recipients.size === 0) return;
    const transaction = em.getTransactionContext<TransactionKey>();
    if (!transaction) {
      this.signal.notify(recipients);
      return;
    }
    const pending = this.inTransaction.get(transaction) ?? new Set<string>();
    for (const id of recipients) pending.add(id);
    this.inTransaction.set(transaction, pending);
  }

  afterTransactionCommit({ transaction }: TransactionEventArgs): void {
    if (!transaction) return;
    const pending = this.inTransaction.get(transaction);
    this.inTransaction.delete(transaction);
    // A savepoint release is not a commit: see the class comment.
    if (pending && !transaction.savepointName) this.signal.notify(pending);
  }

  afterTransactionRollback({ transaction }: TransactionEventArgs): void {
    if (transaction) this.inTransaction.delete(transaction);
  }
}
