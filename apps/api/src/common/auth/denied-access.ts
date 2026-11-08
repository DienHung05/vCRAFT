import type { MikroORM } from '@mikro-orm/core';
import { AuditLog } from '@vcraft/database';
import { type AppError, forbidden } from '../errors/app-error';
import type { Actor } from './auth.guard';

/**
 * AC-4 (GH#237): a signed-in household that tries to change a record belonging to another household gets
 * 403 and the attempt is written to the audit log. The entry is saved on its own connection, so it stays
 * even though the request's transaction rolls back when the returned error is thrown.
 */
export async function deniedAccess(
  orm: MikroORM,
  actor: Actor,
  entity: string,
  entityId: string,
): Promise<AppError> {
  const em = orm.em.fork();
  em.create(AuditLog, {
    actorId: actor.id,
    action: 'access.denied',
    entity,
    entityId,
    before: null,
    after: { role: actor.role },
  });
  await em.flush();
  return forbidden(`this ${entity} belongs to another household`);
}
