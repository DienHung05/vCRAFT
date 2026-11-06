import type { EntityManager } from '@mikro-orm/core';
import { OutboxEvent } from '../entities/outbox-event.entity.js';

/** Outbox event the worker turns into an `assistant.ingest` job (ADR-13, GH#79). */
export const KNOWLEDGE_CHANGED_EVENT = 'knowledge.changed';

export type KnowledgeSourceType = 'PRODUCT' | 'HOUSEHOLD' | 'NEWS';

/**
 * Tells the Fox assistant's index that some public content may have changed, inside the caller's
 * transaction so the event exists only if the change commits. The worker re-reads the row and indexes
 * it if it is public, or removes it from the index if not; a household change also covers its products.
 */
export function queueKnowledgeChange(
  em: EntityManager,
  sourceType: KnowledgeSourceType,
  sourceId: string,
): void {
  em.create(OutboxEvent, { type: KNOWLEDGE_CHANGED_EVENT, payload: { sourceType, sourceId } });
}
