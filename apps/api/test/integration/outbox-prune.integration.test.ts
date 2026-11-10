import { countFailedOutboxEvents, OutboxEvent, purgeDoneOutboxEvents } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const DAY_MS = 86_400_000;

/** GH#349: finished outbox events are pruned after 7 days; failed ones stay for a person to look at. */
describe('Outbox pruning', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  });

  afterAll(async () => {
    await db?.stop();
  });

  it('deletes old DONE events, keeps recent DONE and every FAILED or PENDING one', async () => {
    const now = new Date();
    const old = new Date(now.getTime() - 8 * DAY_MS);
    const recent = new Date(now.getTime() - 2 * DAY_MS);
    const seed = db.orm.em.fork();
    const make = (status: 'DONE' | 'FAILED' | 'PENDING', updatedAt: Date) =>
      seed.create(OutboxEvent, { type: 'prune.test', payload: {}, status, updatedAt });
    const oldDone = [make('DONE', old), make('DONE', old), make('DONE', old)];
    const recentDone = make('DONE', recent);
    const oldFailed = make('FAILED', old);
    const oldPending = make('PENDING', old);
    await seed.flush();
    // `updatedAt` is stamped on insert, so set the ages explicitly afterwards.
    for (const event of [...oldDone, recentDone, oldFailed, oldPending]) {
      await seed.nativeUpdate(OutboxEvent, { id: event.id }, { updatedAt: event.updatedAt });
    }

    expect(await purgeDoneOutboxEvents(db.orm, now)).toBe(3);

    const left = await db.orm.em.fork().find(OutboxEvent, { type: 'prune.test' });
    expect(left.map((e) => e.id).sort()).toEqual(
      [recentDone.id, oldFailed.id, oldPending.id].sort(),
    );
    expect(await countFailedOutboxEvents(db.orm)).toBe(1);
    expect(await purgeDoneOutboxEvents(db.orm, now)).toBe(0);
  });
});
