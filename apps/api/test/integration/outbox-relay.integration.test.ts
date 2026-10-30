import {
  claimOutboxEvents,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_STALE_AFTER_MS,
  OutboxEvent,
} from '@vcraft/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { relayOutbox } from '../../../worker/src/processors/outbox/relay-outbox.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** BR-L8: outbox relay của worker trên PostgreSQL và MySQL. */
describe('outbox relay', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  });

  afterAll(async () => {
    await db?.stop();
  });

  beforeEach(async () => {
    await db.orm.em.fork().nativeDelete(OutboxEvent, {});
  });

  async function seed(type: string, extra: Partial<OutboxEvent> = {}) {
    const em = db.orm.em.fork();
    const event = em.create(OutboxEvent, { type, payload: { n: 1 }, ...extra });
    await em.flush();
    return event.id;
  }

  const load = (id: string) => db.orm.em.fork().findOneOrFail(OutboxEvent, id);

  it('chuyển tiếp thành công ⇒ DONE; mỗi sự kiện được giao đúng một lần trong một lượt', async () => {
    const ids = [await seed('a'), await seed('b')];
    const seen: string[] = [];
    const result = await relayOutbox(db.orm, async (event) => {
      seen.push(event.id);
    });
    expect(result).toEqual({ claimed: 2, failed: 0 });
    expect(seen.sort()).toEqual([...ids].sort());
    for (const id of ids) expect((await load(id)).status).toBe('DONE');
    expect((await relayOutbox(db.orm, async () => {})).claimed).toBe(0);
  });

  it('lỗi một sự kiện không chặn sự kiện khác; sự kiện lỗi lùi lịch rồi thành FAILED', async () => {
    const bad = await seed('bad');
    const good = await seed('good');
    const dispatch = async (event: { type: string }) => {
      if (event.type === 'bad') throw new Error('redis down');
    };
    expect(await relayOutbox(db.orm, dispatch)).toEqual({ claimed: 2, failed: 1 });
    expect((await load(good)).status).toBe('DONE');
    const retried = await load(bad);
    expect(retried.status).toBe('PENDING');
    expect(retried.attempts).toBe(1);
    expect(retried.availableAt.getTime()).toBeGreaterThan(Date.now());

    // Chưa tới lịch thử lại thì không nhận
    expect((await relayOutbox(db.orm, dispatch)).claimed).toBe(0);

    await db.orm.em
      .fork()
      .nativeUpdate(
        OutboxEvent,
        { id: bad },
        { attempts: OUTBOX_MAX_ATTEMPTS - 1, availableAt: new Date(0) },
      );
    await relayOutbox(db.orm, dispatch);
    expect((await load(bad)).status).toBe('FAILED');
  });

  it('sự kiện PROCESSING bị bỏ dở quá lâu được nhận lại; vừa nhận thì không', async () => {
    const fresh = await seed('fresh', { status: 'PROCESSING' });
    const stale = await seed('stale', { status: 'PROCESSING' });
    await db.orm.em
      .fork()
      .nativeUpdate(
        OutboxEvent,
        { id: stale },
        { updatedAt: new Date(Date.now() - OUTBOX_STALE_AFTER_MS - 1_000) },
      );
    const claimed = await claimOutboxEvents(db.orm.em, 10);
    expect(claimed.map((event) => event.id)).toEqual([stale]);
    expect((await load(fresh)).status).toBe('PROCESSING');
  });

  it('hai relay song song không nhận trùng sự kiện', async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, (_, n) => seed(`p${n}`)));
    const seen: string[] = [];
    const dispatch = async (event: { id: string }) => {
      seen.push(event.id);
    };
    await Promise.all([relayOutbox(db.orm, dispatch, 3), relayOutbox(db.orm, dispatch, 3)]);
    await relayOutbox(db.orm, dispatch, 10);
    expect(seen.sort()).toEqual([...ids].sort());
  });
});
