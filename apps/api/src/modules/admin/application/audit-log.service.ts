import { type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuditActorDto, AuditLogPageDto, AuditLogQuery } from '@vcraft/contracts';
import { AppUser, AuditLog } from '@vcraft/database';
import { AppError } from '../../../common/errors/app-error';

interface AuditCursor {
  t: string;
  id: string;
}

function decodeCursor(raw: string): AuditCursor {
  try {
    const value = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<AuditCursor>;
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

const accountName = (user: AppUser) => user.fullName ?? user.email;

/** Read side of the append-only audit log (FR-ADM-05). */
@Injectable()
export class AuditLogService {
  constructor(private readonly orm: MikroORM) {}

  async list(query: AuditLogQuery): Promise<AuditLogPageDto> {
    const em = this.orm.em.fork();
    const and: FilterQuery<AuditLog>[] = [];
    if (query.actorId) and.push({ actorId: query.actorId });
    if (query.action) and.push({ action: query.action });
    if (query.from) and.push({ createdAt: { $gte: new Date(`${query.from}T00:00:00.000+07:00`) } });
    if (query.to) and.push({ createdAt: { $lte: new Date(`${query.to}T23:59:59.999+07:00`) } });
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const at = new Date(cursor.t);
      and.push({
        $or: [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: cursor.id } }],
      });
    }
    const rows = await em.find(
      AuditLog,
      { $and: and },
      { orderBy: { createdAt: 'desc', id: 'desc' }, limit: query.limit + 1 },
    );
    const page = rows.slice(0, query.limit);
    const actors = await em.find(AppUser, {
      id: { $in: [...new Set(page.map((row) => row.actorId))] },
    });
    const names = new Map(actors.map((user) => [user.id, accountName(user)]));
    const last = page.at(-1);
    return {
      data: page.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorName: names.get(row.actorId) ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        before: row.before ?? null,
        after: row.after ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({
                t: last.createdAt.toISOString(),
                id: last.id,
              } satisfies AuditCursor),
            ).toString('base64url')
          : null,
    };
  }

  async actors(): Promise<AuditActorDto[]> {
    const admins = await this.orm.em
      .fork()
      .find(AppUser, { role: 'ADMIN' }, { orderBy: { email: 'asc' } });
    return admins.map((user) => ({ id: user.id, name: accountName(user) }));
  }
}
