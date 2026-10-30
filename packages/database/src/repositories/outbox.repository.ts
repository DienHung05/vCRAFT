import { type EntityManager, LockMode } from '@mikro-orm/core';
import { OutboxEvent } from '../entities/outbox-event.entity.js';

/** Sau số lần thử này sự kiện chuyển `FAILED` và chờ người xem (BR-L8). */
export const OUTBOX_MAX_ATTEMPTS = 5;

/** Sự kiện `PROCESSING` quá lâu coi như worker đã chết giữa chừng và được nhận lại. */
export const OUTBOX_STALE_AFTER_MS = 5 * 60_000;

/**
 * Nhận một lô sự kiện để chuyển tiếp (outbox relay). `SKIP LOCKED` nên nhiều worker chạy song song
 * không nhận trùng; giao hàng là "ít nhất một lần" nên bên nhận phải idempotent (job id = id nghiệp vụ).
 */
export async function claimOutboxEvents(
  em: EntityManager,
  limit: number,
  now: Date = new Date(),
): Promise<OutboxEvent[]> {
  return em.fork().transactional(async (tx) => {
    const rows = await tx.find(
      OutboxEvent,
      {
        $or: [
          { status: 'PENDING', availableAt: { $lte: now } },
          {
            status: 'PROCESSING',
            updatedAt: { $lt: new Date(now.getTime() - OUTBOX_STALE_AFTER_MS) },
          },
        ],
      },
      { orderBy: { availableAt: 'asc' }, limit, lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE },
    );
    for (const row of rows) {
      row.status = 'PROCESSING';
      row.attempts += 1;
      row.updatedAt = now;
    }
    return rows;
  });
}

export async function completeOutboxEvent(em: EntityManager, id: string): Promise<void> {
  await em.fork().nativeUpdate(OutboxEvent, { id }, { status: 'DONE', updatedAt: new Date() });
}

/** Lùi lịch thử lại theo cấp số nhân (2s, 4s, 8s...); hết lượt thì `FAILED`. */
export async function retryOutboxEvent(
  em: EntityManager,
  event: Pick<OutboxEvent, 'id' | 'attempts'>,
  now: Date = new Date(),
): Promise<void> {
  const failed = event.attempts >= OUTBOX_MAX_ATTEMPTS;
  await em.fork().nativeUpdate(
    OutboxEvent,
    { id: event.id },
    {
      status: failed ? 'FAILED' : 'PENDING',
      availableAt: new Date(now.getTime() + 2_000 * 2 ** (event.attempts - 1)),
      updatedAt: now,
    },
  );
}
