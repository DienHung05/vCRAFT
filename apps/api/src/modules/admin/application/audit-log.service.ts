import { type EntityManager, type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { AuditActorDto, AuditLogPageDto, AuditLogQuery } from '@vcraft/contracts';
import { AppUser, AuditLog, Household, News } from '@vcraft/database';
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

/**
 * A safe, readable target label for one audit entry (FR-ADM-05, vCRAFT-8my.5). Only non-sensitive
 * names/titles travel: the snapshot written with the event is the source for deleted rows (the row
 * itself may be gone), and extraction is restricted to `household.name` / `news.title`, so no other
 * snapshot value can leak. Legacy entries without such a snapshot fall back to `null` — the UI then
 * shows the entity kind, and `entityId` stays available for diagnosis either way.
 */
function snapshotLabel(entry: AuditLog): string | null {
  const key = entry.entity === 'household' ? 'name' : entry.entity === 'news' ? 'title' : null;
  if (key === null) return null;
  for (const values of [entry.after, entry.before] as Record<string, unknown>[]) {
    const label = values?.[key];
    if (typeof label === 'string' && label.trim() !== '') return label.trim().slice(0, 300);
  }
  return null;
}

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
    // A deleted account has no name any more (NFR-SEC-07).
    const names = new Map(
      actors
        .filter((user) => user.status !== 'DELETED')
        .map((user) => [user.id, accountName(user)]),
    );
    const labels = await this.targetLabels(em, page);
    const last = page.at(-1);
    return {
      data: page.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        actorName: names.get(row.actorId) ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        targetLabel: labels.get(row.id) ?? null,
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

  /**
   * Resolves labels for one page: the snapshot's name/title first (this also covers deleted rows),
   * then at most one bulk `find` per entity kind for the remaining rows whose target still exists.
   * Two queries per page in total — never one per row. An unresolved row (a legacy entry, or a
   * deleted target without a snapshot) stays `null` and the UI falls back to the entity kind.
   */
  private async targetLabels(em: EntityManager, page: AuditLog[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    // Snapshot labels first: they cover deleted rows and never need a lookup.
    for (const row of page) {
      const snapshot = snapshotLabel(row);
      if (snapshot !== null) labels.set(row.id, snapshot);
    }
    const pendingIds = (entity: 'household' | 'news') => [
      ...new Set(
        page
          .filter((row) => row.entity === entity && !labels.has(row.id))
          .map((row) => row.entityId),
      ),
    ];
    const householdNames = await this.namesOf(em, pendingIds('household'));
    const newsTitles = await this.newsTitles(em, pendingIds('news'));
    for (const row of page) {
      if (labels.has(row.id)) continue;
      const label =
        row.entity === 'household'
          ? householdNames.get(row.entityId)
          : row.entity === 'news'
            ? newsTitles.get(row.entityId)
            : undefined;
      if (label !== undefined) labels.set(row.id, label);
    }
    return labels;
  }

  /** One bounded bulk lookup of household names; a missing id means the row is gone. */
  private async namesOf(em: EntityManager, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await em.find(Household, { id: { $in: ids } }, { fields: ['id', 'name'] });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  /** Same bounded bulk lookup for news titles; a deleted row keeps its snapshot or falls back. */
  private async newsTitles(em: EntityManager, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await em.find(News, { id: { $in: ids } }, { fields: ['id', 'title'] });
    return new Map(rows.map((row) => [row.id, row.title]));
  }
}
