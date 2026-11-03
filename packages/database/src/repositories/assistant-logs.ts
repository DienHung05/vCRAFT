import type { MikroORM } from '@mikro-orm/core';
import { AssistantMessageLog } from '../entities/assistant-message-log.entity.js';

/** Assistant logs are kept 30 days (PLAN E15). */
export const ASSISTANT_LOG_DAYS = 30;

/** Deletes assistant log rows older than 30 days; returns how many went. Run daily by the worker. */
export async function purgeAssistantLogs(orm: MikroORM, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - ASSISTANT_LOG_DAYS * 86_400_000);
  return orm.em.fork().nativeDelete(AssistantMessageLog, { createdAt: { $lt: before } });
}
