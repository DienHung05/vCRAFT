import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_CHANGED_EVENT } from '../src/repositories/knowledge-events.js';
import { queueNewlyLiveNews } from '../src/repositories/news-indexing.js';

type Row = {
  id: string;
  status: string;
  publishedAt: Date | null;
  indexedAt: Date | null;
};

/** Just enough of an ORM: one table of news rows and a list of created outbox events. */
function fakeOrm(rows: Row[]) {
  const events: { type: string; payload: unknown }[] = [];
  const em: Record<string, unknown> = {
    find: async (_entity: unknown, where: { publishedAt: { $lte: Date } }) =>
      rows.filter(
        (r) =>
          r.status === 'PUBLISHED' &&
          r.indexedAt === null &&
          r.publishedAt !== null &&
          r.publishedAt <= where.publishedAt.$lte,
      ),
    findOne: async (_entity: unknown, id: string) => rows.find((r) => r.id === id) ?? null,
    create: (_entity: unknown, data: { type: string; payload: unknown }) => {
      events.push(data);
      return data;
    },
    transactional: async (fn: (tx: unknown) => Promise<void>) => fn(em),
    fork: (): unknown => em,
  };
  return { orm: { em } as never, events };
}

describe('queueNewlyLiveNews', () => {
  const now = new Date('2026-11-10T10:00:00Z');

  it('queues a story that went live since the last sweep exactly once', async () => {
    const live: Row = {
      id: 'n1',
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 30_000),
      indexedAt: null,
    };
    const { orm, events } = fakeOrm([live]);
    expect(await queueNewlyLiveNews(orm, now)).toBe(1);
    expect(events).toEqual([
      { type: KNOWLEDGE_CHANGED_EVENT, payload: { sourceType: 'NEWS', sourceId: 'n1' } },
    ]);
    expect(live.indexedAt).toEqual(now);
    expect(await queueNewlyLiveNews(orm, now)).toBe(0);
    expect(events).toHaveLength(1);
  });

  it('leaves stories that are still scheduled for later', async () => {
    const future: Row = {
      id: 'n2',
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() + 3_600_000),
      indexedAt: null,
    };
    const { orm, events } = fakeOrm([future]);
    expect(await queueNewlyLiveNews(orm, now)).toBe(0);
    expect(events).toHaveLength(0);
    expect(await queueNewlyLiveNews(orm, new Date(now.getTime() + 2 * 3_600_000))).toBe(1);
    expect(events).toHaveLength(1);
  });
});
