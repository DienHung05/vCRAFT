import { randomUUID } from 'node:crypto';
import { Notification, QuotationNotice } from '@vcraft/database';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveSignal } from '../../src/modules/notifications/application/live-signal.js';
import { NotificationPublisher } from '../../src/modules/notifications/application/notification-publisher.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#537: a notice committed by this API instance wakes the recipient's live streams, and only once the
 * data is visible to other connections. A rolled-back transaction wakes nobody.
 */
describe('Live notice signal', () => {
  let db: TestDatabase;
  let t: TestApp;
  let signal: LiveSignal;
  let publisher: NotificationPublisher;
  let buyer: { id: string };
  let other: { id: string };
  let woken: string[];

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    signal = t.app.get(LiveSignal);
    publisher = t.app.get(NotificationPublisher);
    buyer = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  beforeEach(() => {
    woken = [];
    vi.spyOn(signal, 'notify').mockImplementation((ids) => {
      woken.push(...ids);
    });
  });

  const publish = (em: Parameters<NotificationPublisher['publish']>[0], recipientId: string) =>
    publisher.publish(em, {
      type: 'HOUSEHOLD_APPROVED',
      actorId: other.id,
      recipientIds: [recipientId],
      email: false,
    });

  /** Counts the recipient's notifications through a connection that is not part of the transaction. */
  const visible = (recipientId: string) => db.orm.em.fork().count(Notification, { recipientId });

  it('wakes the recipient after the publishing transaction commits, not before', async () => {
    let wokenBeforeCommit: string[] = [];
    let visibleBeforeCommit = -1;
    await db.orm.em.transactional(async (em) => {
      publish(em, buyer.id);
      await em.flush();
      wokenBeforeCommit = [...woken];
      visibleBeforeCommit = await visible(buyer.id);
    });
    expect(wokenBeforeCommit).toEqual([]);
    expect(visibleBeforeCommit).toBe(0);
    expect(woken).toEqual([buyer.id]);
    expect(await visible(buyer.id)).toBe(1);
  });

  it('does not wake anyone when the transaction rolls back', async () => {
    await expect(
      db.orm.em.transactional(async (em) => {
        publish(em, buyer.id);
        await em.flush();
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(woken).toEqual([]);
    expect(await visible(buyer.id)).toBe(1);
  });

  it('wakes right after a plain flush, which commits on its own, and also for quotation notices', async () => {
    const em = db.orm.em.fork();
    em.create(Notification, { recipientId: other.id, type: 'HOUSEHOLD_APPROVED', subjectId: null });
    em.create(QuotationNotice, { recipientId: buyer.id, requestId: randomUUID() });
    await em.flush();
    expect([...woken].sort()).toEqual([buyer.id, other.id].sort());
  });

  it('does not wake for a flush that only updates', async () => {
    const em = db.orm.em.fork();
    const row = await em.findOneOrFail(Notification, { recipientId: buyer.id });
    row.readAt = new Date();
    await em.flush();
    expect(woken).toEqual([]);
  });
});
