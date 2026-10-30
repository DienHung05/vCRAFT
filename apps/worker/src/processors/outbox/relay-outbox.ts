import type { MikroORM } from '@mikro-orm/core';
import {
  claimOutboxEvents,
  completeOutboxEvent,
  type OutboxEvent,
  retryOutboxEvent,
} from '@vcraft/database';

/** Chuyển một sự kiện outbox thành job; phải idempotent vì giao hàng là "ít nhất một lần". */
export type OutboxDispatcher = (
  event: Pick<OutboxEvent, 'id' | 'type' | 'payload'>,
) => Promise<void>;

/**
 * Job `outbox` (BR-L8): nhận một lô sự kiện đã commit cùng thay đổi nghiệp vụ và đẩy sang hàng đợi
 * media/mail. Lỗi một sự kiện không chặn cả lô; sự kiện lỗi được thử lại có lùi lịch.
 */
export async function relayOutbox(
  orm: MikroORM,
  dispatch: OutboxDispatcher,
  limit = 50,
): Promise<{ claimed: number; failed: number }> {
  const events = await claimOutboxEvents(orm.em, limit);
  let failed = 0;
  for (const event of events) {
    try {
      await dispatch(event);
      await completeOutboxEvent(orm.em, event.id);
    } catch {
      failed += 1;
      await retryOutboxEvent(orm.em, event);
    }
  }
  return { claimed: events.length, failed };
}
