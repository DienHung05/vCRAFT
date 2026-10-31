import type { EntityManager, MikroORM } from '@mikro-orm/core';
import { Household } from '../entities/household.entity.js';
import { News } from '../entities/news.entity.js';
import { Notification } from '../entities/notification.entity.js';
import { OutboxEvent } from '../entities/outbox-event.entity.js';

/** Sends one important item to every approved household, and marks it so it is never sent twice. */
export async function notifyHouseholdsOfNews(em: EntityManager, news: News, now: Date) {
  const households = await em.find(
    Household,
    { status: 'APPROVED', representative: { status: 'ACTIVE' } },
    { populate: ['representative'] },
  );
  const noticeIds = [...new Set(households.map((household) => household.representative.id))].map(
    (recipientId) =>
      em.create(Notification, { recipientId, type: 'NEWS_PUBLISHED', subjectId: news.id }).id,
  );
  if (noticeIds.length > 0)
    em.create(OutboxEvent, { type: 'notification.created', payload: { noticeIds } });
  news.notifiedAt = now;
}

/**
 * Important items whose time has come and that nobody has been told about yet: scheduled news
 * reaching its date. The worker runs this on its relay tick. Two workers racing over one item
 * end in an optimistic lock failure for the second, so households are still told only once.
 */
export async function notifyDueImportantNews(orm: MikroORM, now = new Date()) {
  const due = await orm.em
    .fork()
    .find(
      News,
      { status: 'PUBLISHED', important: true, notifiedAt: null, publishedAt: { $lte: now } },
      { fields: ['id'], limit: 20 },
    );
  for (const { id } of due) {
    await orm.em.fork().transactional(async (em) => {
      const news = await em.findOneOrFail(News, id);
      if (news.notifiedAt) return;
      await notifyHouseholdsOfNews(em, news, now);
    });
  }
  return due.length;
}
