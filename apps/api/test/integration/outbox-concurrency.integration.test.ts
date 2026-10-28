import { LockMode, OptimisticLockError } from '@mikro-orm/core';
import { OutboxEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * SRS §4.4 (khóa bản ghi) và BR-L8: hai cơ chế tranh chấp ở tầng dữ liệu, kiểm trên cả hai CSDL.
 * Đây là nền cho test tranh chấp nghiệp vụ (chốt báo giá) khi module RFQ có mặt.
 */
describe('Tranh chấp trên OutboxEvent', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  });

  afterAll(async () => {
    await db?.stop();
  });

  it('khóa lạc quan: hai phiên cùng sửa một bản ghi, phiên sau bị từ chối và dữ liệu không bị ghi đè', async () => {
    const seed = db.orm.em.fork();
    const created = seed.create(OutboxEvent, { type: 'optimistic', payload: {} });
    await seed.flush();

    const first = db.orm.em.fork();
    const second = db.orm.em.fork();
    const a = await first.findOneOrFail(OutboxEvent, { id: created.id });
    const b = await second.findOneOrFail(OutboxEvent, { id: created.id });

    a.status = 'PROCESSING';
    await first.flush();

    b.status = 'FAILED';
    await expect(second.flush()).rejects.toBeInstanceOf(OptimisticLockError);

    const final = await db.orm.em.fork().findOneOrFail(OutboxEvent, { id: created.id });
    expect(final.status).toBe('PROCESSING');
    expect(final.version).toBe(2);
  });

  it('SKIP LOCKED: hai worker claim đồng thời không bao giờ nhận cùng một sự kiện', async () => {
    const seed = db.orm.em.fork();
    const type = `claim-${Date.now()}`;
    const events = [1, 2].map((n) => seed.create(OutboxEvent, { type, payload: { n } }));
    await seed.flush();
    const wanted = new Set(events.map((e) => e.id));

    // Cả hai transaction cùng giữ khóa dòng trước khi bên nào commit
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let claimed = 0;
    const claim = (): Promise<string[]> =>
      db.orm.em.fork().transactional(async (em) => {
        const rows = await em.find(
          OutboxEvent,
          { type, status: 'PENDING' },
          { limit: 1, lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE },
        );
        claimed += 1;
        if (claimed === 2) release();
        await gate;
        for (const row of rows) row.status = 'PROCESSING';
        return rows.map((r) => r.id);
      });

    const [x, y] = await Promise.all([claim(), claim()]);
    expect(x).toHaveLength(1);
    expect(y).toHaveLength(1);
    expect(x?.[0]).not.toBe(y?.[0]);
    expect(new Set([...(x ?? []), ...(y ?? [])])).toEqual(wanted);

    const processing = await db.orm.em.fork().count(OutboxEvent, { type, status: 'PROCESSING' });
    expect(processing).toBe(2);
  });
});
