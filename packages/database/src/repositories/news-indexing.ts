import type { MikroORM } from '@mikro-orm/core';
import { News } from '../entities/news.entity.js';
import { queueKnowledgeChange } from './knowledge-events.js';

/**
 * Stories that are live but were never queued for the assistant index while live: scheduled news
 * reaching its date (GH#430). Saving a live story marks it indexed at once, so this sweep only finds
 * what became public by the passage of time. The worker runs it on its relay tick; a restart loses
 * nothing because the state is the `indexedAt` column, not a timer. Two workers racing over one story
 * end in an optimistic lock failure for the second, so it is queued only once.
 */
export async function queueNewlyLiveNews(orm: MikroORM, now = new Date()) {
  const due = await orm.em
    .fork()
    .find(
      News,
      { status: 'PUBLISHED', indexedAt: null, publishedAt: { $lte: now } },
      { fields: ['id'], limit: 50 },
    );
  for (const { id } of due) {
    await orm.em.fork().transactional(async (em) => {
      const news = await em.findOne(News, id);
      if (!news || news.indexedAt || news.status !== 'PUBLISHED') return;
      if (!news.publishedAt || news.publishedAt > now) return;
      news.indexedAt = now;
      queueKnowledgeChange(em, 'NEWS', id);
    });
  }
  return due.length;
}
