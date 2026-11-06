import type { EntityManager } from '@mikro-orm/core';
import { SlugRedirect, type SlugRedirectKind } from '@vcraft/database';

/**
 * Records that `targetId` moved from `oldSlug` to `newSlug`, inside the caller's transaction. A redirect
 * already sitting on `newSlug` (the entity went back to an earlier name) is dropped, so a slug is never
 * both live and redirected; an existing row for `oldSlug` is repointed rather than duplicated.
 */
export async function retireSlug(
  em: EntityManager,
  kind: SlugRedirectKind,
  targetId: string,
  oldSlug: string,
  newSlug: string,
): Promise<void> {
  if (oldSlug === newSlug) return;
  const reclaimed = await em.findOne(SlugRedirect, { kind, oldSlug: newSlug });
  if (reclaimed) em.remove(reclaimed);
  const existing = await em.findOne(SlugRedirect, { kind, oldSlug });
  if (existing) existing.targetId = targetId;
  else em.create(SlugRedirect, { kind, oldSlug, targetId });
}

/** Whether a retired `slug` is held by another entity of the same kind (it may not be reused). */
export async function slugRetiredByOther(
  em: EntityManager,
  kind: SlugRedirectKind,
  slug: string,
  targetId: string,
): Promise<boolean> {
  const row = await em.findOne(SlugRedirect, { kind, oldSlug: slug });
  return row !== null && row.targetId !== targetId;
}
