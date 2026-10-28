import { OutboxEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** BR-L8: Transactional Outbox. Kiểm tra migration và ghi/đọc entity trên CSDL thật (PostgreSQL | MySQL). */
describe('OutboxEvent trên CSDL thật', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
  });

  afterAll(async () => {
    await db?.stop();
  });

  it('migration khớp entity: schema không còn lệch sau khi chạy migration', async () => {
    const diff = await db.orm.schema.getUpdateSchemaSQL();
    expect(diff.trim()).toBe('');
  });

  it('ghi rồi đọc lại: mặc định, uuid v7, JSON payload và mốc thời gian được giữ nguyên', async () => {
    const payload = { rfqId: 'r-1', nested: { items: [1, 2, 3], tên: 'Bát Tràng' } };
    const em = db.orm.em.fork();
    const created = em.create(OutboxEvent, { type: 'rfq.submitted', payload });
    await em.flush();

    const loaded = await db.orm.em.fork().findOneOrFail(OutboxEvent, { id: created.id });
    expect(loaded.id).toMatch(UUID_V7);
    expect(loaded.type).toBe('rfq.submitted');
    expect(loaded.payload).toEqual(payload);
    expect(loaded.status).toBe('PENDING');
    expect(loaded.attempts).toBe(0);
    expect(loaded.version).toBe(1);
    expect(loaded.createdAt.getTime()).toBe(created.createdAt.getTime());
    expect(loaded.availableAt.getTime()).toBe(created.availableAt.getTime());
  });

  it('cập nhật tăng version và đổi updatedAt', async () => {
    const em = db.orm.em.fork();
    const event = em.create(OutboxEvent, { type: 'bid.accepted', payload: {} });
    await em.flush();
    const firstUpdatedAt = event.updatedAt.getTime();

    await new Promise((resolve) => setTimeout(resolve, 5));
    event.status = 'DONE';
    await em.flush();

    const loaded = await db.orm.em.fork().findOneOrFail(OutboxEvent, { id: event.id });
    expect(loaded.status).toBe('DONE');
    expect(loaded.version).toBe(2);
    expect(loaded.updatedAt.getTime()).toBeGreaterThan(firstUpdatedAt);
  });

  it('truy vấn theo (status, availableAt) chỉ trả sự kiện đến hạn', async () => {
    const em = db.orm.em.fork();
    const due = em.create(OutboxEvent, {
      type: 'due',
      payload: {},
      availableAt: new Date(Date.now() - 60_000),
    });
    const later = em.create(OutboxEvent, {
      type: 'later',
      payload: {},
      availableAt: new Date(Date.now() + 3_600_000),
    });
    await em.flush();

    const found = await db.orm.em
      .fork()
      .find(OutboxEvent, { status: 'PENDING', availableAt: { $lte: new Date() } });
    const ids = found.map((e) => e.id);
    expect(ids).toContain(due.id);
    expect(ids).not.toContain(later.id);
  });
});
