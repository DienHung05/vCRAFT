import { type EntityManager, type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  AdminNewsDto,
  AdminNewsListDto,
  AuditAction,
  ListAdminNewsQuery,
  SaveNewsRequest,
} from '@vcraft/contracts';
import { AuditLog, MediaAsset, MediaLink, News, notifyHouseholdsOfNews } from '@vcraft/database';
import { slugify } from '@vcraft/utils';
import type { Actor } from '../../../common/auth/auth.guard';
import { assertVersion } from '../../../common/domain/unwrap';
import { AppError, forbidden, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { newsTextOf, paragraphsOf, sanitizeNewsHtml } from './sanitize-news';

/** `village` is a route under `/news`, and an id-shaped slug would be read as an id. */
const RESERVED_SLUG = /^(village|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

interface AdminNewsCursor {
  t: string;
  id: string;
}

function decodeCursor(raw: string): AdminNewsCursor {
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
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

const stateOf = (news: News, now: Date) =>
  news.status === 'DRAFT'
    ? ('DRAFT' as const)
    : news.publishedAt && news.publishedAt > now
      ? ('SCHEDULED' as const)
      : ('PUBLISHED' as const);

const auditValues = (news: News) => ({
  title: news.title,
  status: news.status,
  visibility: news.visibility,
  pinned: news.pinned,
  important: news.important,
  publishedAt: news.publishedAt?.toISOString() ?? null,
});

/** News management for administrators (FR-NEWS-01, 02, 05). */
@Injectable()
export class NewsAdminService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
  ) {}

  async list(query: ListAdminNewsQuery): Promise<AdminNewsListDto> {
    const em = this.orm.em.fork();
    const now = new Date();
    const and: FilterQuery<News>[] = [];
    if (query.state === 'DRAFT') and.push({ status: 'DRAFT' });
    if (query.state === 'SCHEDULED') and.push({ status: 'PUBLISHED', publishedAt: { $gt: now } });
    if (query.state === 'PUBLISHED') and.push({ status: 'PUBLISHED', publishedAt: { $lte: now } });
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const at = new Date(cursor.t);
      and.push({ $or: [{ createdAt: { $lt: at } }, { createdAt: at, id: { $lt: cursor.id } }] });
    }
    const rows = await em.find(
      News,
      { $and: and },
      {
        populate: ['household'],
        orderBy: { createdAt: 'desc', id: 'desc' },
        limit: query.limit + 1,
      },
    );
    const page = rows.slice(0, query.limit);
    const covers = await this.covers(page.map((news) => news.id));
    const last = page.at(-1);
    return {
      data: page.map((news) => toAdminDto(news, covers.get(news.id) ?? null, now)),
      nextCursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({
                t: last.createdAt.toISOString(),
                id: last.id,
              } satisfies AdminNewsCursor),
            ).toString('base64url')
          : null,
    };
  }

  async get(id: string): Promise<AdminNewsDto> {
    const news = await this.orm.em.fork().findOne(News, id, { populate: ['household'] });
    if (!news) throw notFound();
    return toAdminDto(news, (await this.covers([id])).get(id) ?? null, new Date());
  }

  async create(actor: Actor, input: SaveNewsRequest): Promise<AdminNewsDto> {
    if (actor.locked) throw forbidden();
    await this.assertCover(actor, input);
    const id = await this.orm.em.fork().transactional(async (em) => {
      const now = new Date();
      const content = this.content(input);
      const news = em.create(News, {
        ...content,
        slug: await this.slug(em, input),
        category: input.category,
        visibility: input.visibility,
        pinned: input.pinned,
        important: input.important,
        status: input.status,
        publishedAt: input.status === 'PUBLISHED' ? this.publishAt(input, null, now) : null,
      });
      await this.saveCover(em, news.id, input);
      await this.notifyIfLive(em, news, now);
      this.audit(em, actor, 'news.create', news.id, null, auditValues(news));
      await em.flush();
      return news.id;
    });
    return this.get(id);
  }

  async update(
    actor: Actor,
    id: string,
    version: number,
    input: SaveNewsRequest,
  ): Promise<AdminNewsDto> {
    if (actor.locked) throw forbidden();
    await this.assertCover(actor, input);
    await this.orm.em.fork().transactional(async (em) => {
      const news = await em.findOne(News, id);
      if (!news) throw notFound();
      assertVersion(news, version);
      const now = new Date();
      const before = auditValues(news);
      const wasDraft = news.status === 'DRAFT';
      Object.assign(news, this.content(input), {
        category: input.category,
        visibility: input.visibility,
        pinned: input.pinned,
        important: input.important,
        status: input.status,
        publishedAt:
          input.status === 'PUBLISHED'
            ? this.publishAt(input, news.publishedAt ?? null, now)
            : null,
      });
      if (input.slug && input.slug !== news.slug) news.slug = await this.slug(em, input, news.id);
      await this.saveCover(em, news.id, input);
      await this.notifyIfLive(em, news, now);
      const action: AuditAction =
        wasDraft && news.status === 'PUBLISHED'
          ? 'news.publish'
          : !wasDraft && news.status === 'DRAFT'
            ? 'news.unpublish'
            : 'news.update';
      this.audit(em, actor, action, news.id, before, auditValues(news));
      await em.flush();
    });
    return this.get(id);
  }

  async remove(actor: Actor, id: string, version: number): Promise<void> {
    if (actor.locked) throw forbidden();
    await this.orm.em.fork().transactional(async (em) => {
      const news = await em.findOne(News, id);
      if (!news) throw notFound();
      assertVersion(news, version);
      this.audit(em, actor, 'news.delete', news.id, auditValues(news), null);
      await em.nativeDelete(MediaLink, { targetType: 'NEWS', targetId: news.id });
      em.remove(news);
      await em.flush();
    });
  }

  private content(input: SaveNewsRequest) {
    const bodyHtml = sanitizeNewsHtml(input.bodyHtml);
    const body = newsTextOf(bodyHtml);
    if (!body) throw new AppError('VALIDATION_FAILED', 'bodyHtml has no content');
    return { title: input.title, summary: input.summary, body, bodyHtml };
  }

  /** A future time schedules. Otherwise an item keeps the date it first went live. */
  private publishAt(input: SaveNewsRequest, current: Date | null, now: Date): Date {
    if (input.publishAt) {
      const requested = new Date(input.publishAt);
      if (requested > now) return requested;
    }
    return current && current <= now ? current : now;
  }

  /** Important news that is already live tells households now. Scheduled items wait for the worker. */
  private async notifyIfLive(em: EntityManager, news: News, now: Date) {
    if (
      news.important &&
      news.status === 'PUBLISHED' &&
      !news.notifiedAt &&
      news.publishedAt &&
      news.publishedAt <= now
    )
      await notifyHouseholdsOfNews(em, news, now);
  }

  private async slug(em: EntityManager, input: SaveNewsRequest, selfId?: string) {
    if (input.slug) {
      if (RESERVED_SLUG.test(input.slug))
        throw new AppError('VALIDATION_FAILED', 'this slug is reserved');
      const taken = await em.findOne(News, { slug: input.slug }, { fields: ['id'] });
      if (taken && taken.id !== selfId) throw new AppError('CONFLICT_DUPLICATE');
      return input.slug;
    }
    const base = slugify(input.title, 180) || 'tin';
    const safe = RESERVED_SLUG.test(base) ? `tin-${base}` : base;
    for (let suffix = 1; ; suffix++) {
      const candidate = suffix === 1 ? safe : `${safe}-${suffix}`;
      const taken = await em.findOne(News, { slug: candidate }, { fields: ['id'] });
      if (!taken) return candidate;
    }
  }

  private async assertCover(actor: Actor, input: SaveNewsRequest) {
    if (!input.coverMediaId) return;
    const owned = await this.media.ownedBy(actor.id, [input.coverMediaId]);
    const ready = await this.media.publicUrls([input.coverMediaId]);
    if (!owned.has(input.coverMediaId) || !ready.has(input.coverMediaId))
      throw new AppError('VALIDATION_FAILED', 'cover image is not available');
  }

  /** `undefined` leaves the cover alone, so editing text never disturbs an existing image. */
  private async saveCover(em: EntityManager, newsId: string, input: SaveNewsRequest) {
    if (input.coverMediaId === undefined) {
      if (input.coverAlt !== undefined) {
        const link = await em.findOne(MediaLink, {
          targetType: 'NEWS',
          targetId: newsId,
          role: 'COVER',
        });
        if (link) {
          const next = input.coverAlt || null;
          if (next !== (link.altText ?? null)) link.altEn = null;
          link.altText = next;
        }
      }
      return;
    }
    const link = await em.findOne(MediaLink, {
      targetType: 'NEWS',
      targetId: newsId,
      role: 'COVER',
      position: 0,
    });
    if (input.coverMediaId === null) {
      if (link) em.remove(link);
      return;
    }
    const media = em.getReference(MediaAsset, input.coverMediaId);
    if (link) {
      link.media = media;
      link.altText = input.coverAlt || null;
      link.altEn = null;
    } else
      em.create(MediaLink, {
        media,
        targetType: 'NEWS',
        targetId: newsId,
        role: 'COVER',
        altText: input.coverAlt || null,
      });
  }

  private audit(
    em: EntityManager,
    actor: Actor,
    action: AuditAction,
    entityId: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
  ) {
    em.create(AuditLog, { actorId: actor.id, action, entity: 'news', entityId, before, after });
  }

  private async covers(ids: readonly string[]) {
    const linked = await this.media.linkedImages('NEWS', ids, ['COVER']);
    const covers = new Map<string, AdminNewsDto['cover']>();
    for (const [id, [cover]] of linked) if (cover) covers.set(id, cover.image);
    return covers;
  }
}

function toAdminDto(news: News, cover: AdminNewsDto['cover'], now: Date): AdminNewsDto {
  return {
    id: news.id,
    version: news.version,
    slug: news.slug,
    title: news.title,
    summary: news.summary,
    bodyHtml: news.bodyHtml ?? paragraphsOf(news.body),
    category: news.category,
    visibility: news.visibility,
    pinned: news.pinned,
    important: news.important,
    state: stateOf(news, now),
    publishedAt: news.publishedAt?.toISOString() ?? null,
    cover,
    householdName: news.household?.name ?? null,
    updatedAt: news.updatedAt.toISOString(),
  };
}
