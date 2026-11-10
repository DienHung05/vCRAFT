import { randomUUID } from 'node:crypto';
import { Notification } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

describe('notice mail claim (conditional update on emailed_at)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  }, 180_000);

  afterAll(async () => {
    await db?.stop();
  });

  it('lets exactly one caller claim a notification until the claim is released', async () => {
    const em = db.orm.em.fork();
    const id = randomUUID();
    em.create(Notification, { id, recipientId: randomUUID(), type: 'HOUSEHOLD_APPROVED' as never });
    await em.flush();

    const claim = () =>
      db.orm.em
        .fork()
        .nativeUpdate(Notification, { id, emailedAt: null }, { emailedAt: new Date() });
    const results = await Promise.all([claim(), claim(), claim()]);
    expect(results.filter((affected) => affected === 1)).toHaveLength(1);
    expect(await claim()).toBe(0);

    await db.orm.em.fork().nativeUpdate(Notification, { id }, { emailedAt: null });
    expect(await claim()).toBe(1);
  });
});
