import type { EntityManager } from '@mikro-orm/core';
import { EXHIBITION_TAG, normalizeExhibitionTags } from '@vcraft/utils';
import { OutboxEvent } from '../entities/outbox-event.entity.js';

/**
 * Outbox event the worker turns into a `POST` to the web's `/api/revalidate` (ADR-0027). Its payload is
 * `{ tags: string[] }`: Data Cache tags of the public exhibition reads that are now out of date.
 */
export const EXHIBITION_CHANGED_EVENT = 'exhibition.changed';

/**
 * Tells the web that public exhibition content changed, inside the caller's transaction so the event
 * exists only if the change commits. `tags` are `exhibition` (anything that can alter a list, a
 * visibility or a map pin) and/or entity tags (`household:<slug>`, `product:<slug>`, `trace:<CODE>`);
 * invalid or surplus tags widen to `exhibition`. A slug change passes the old slug and the new one.
 */
export function queueExhibitionChange(
  em: EntityManager,
  tags: Iterable<string | null | undefined> = [EXHIBITION_TAG],
): void {
  const normalized = normalizeExhibitionTags(tags);
  em.create(OutboxEvent, {
    type: EXHIBITION_CHANGED_EVENT,
    payload: { tags: normalized.length > 0 ? normalized : [EXHIBITION_TAG] },
  });
}
