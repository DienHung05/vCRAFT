import { OutboxEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createOutboxDispatcher } from '../../../worker/src/processors/outbox/dispatch.js';
import { relayOutbox } from '../../../worker/src/processors/outbox/relay-outbox.js';
import {
  createWebRevalidator,
  webRevalidateFromEnv,
} from '../../../worker/src/processors/outbox/revalidate-web.js';
import { addMilestone, createJournalPhoto } from './support/journal-photo.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * ADR-0027: every change that alters public exhibition content commits an `exhibition.changed` outbox
 * event with the Data Cache tags of the web's cached reads, in the same transaction; the worker's relay
 * delivers it to the web's `/api/revalidate`, and sends nothing when the env is not set.
 */
describe('Exhibition revalidation events', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let rep: { id: string; auth: string };
  let householdId: string;
  let version: number;
  let productId: string;
  let traceCode: string;
  let productSlug: string;

  const sink = { add: vi.fn(async () => undefined) };
  const queues = { media: sink, mail: sink, qrLabels: sink, scheduler: sink, assistant: sink };

  /** Tags of the `exhibition.changed` events recorded since the last call, oldest first. */
  async function drainTags(): Promise<string[][]> {
    const em = db.orm.em.fork();
    const rows = await em.find(
      OutboxEvent,
      { type: 'exhibition.changed' },
      { orderBy: { createdAt: 'asc' } },
    );
    const tags = rows.map((row) => row.payload.tags as string[]);
    await em.nativeDelete(OutboxEvent, { type: 'exhibition.changed' });
    return tags;
  }

  const decide = (action: string, body: object = {}) =>
    t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/${action}`,
      auth: admin.auth,
      headers: { 'if-match': String(version) },
      body,
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Revalidate', slug: 'gom-revalidate', history: 'Ba đời làm gốm.' },
    });
    householdId = applied.body.id;
    version = applied.body.version;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('approval queues the broad tag and the household tag', async () => {
    await drainTags();
    const approved = await decide('approve');
    expect(approved.status).toBe(200);
    version = approved.body.version;
    expect(await drainTags()).toEqual([['exhibition', 'household:gom-revalidate']]);
  });

  it('a journal entry queues only the trace and product tags; publishing queues the broad ones', async () => {
    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình men lam', description: 'Bình cao 40cm' },
    });
    expect(product.status).toBe(201);
    productId = product.body.id;
    traceCode = product.body.traceCode;
    productSlug = product.body.slug;
    await drainTags();

    const milestone = await addMilestone(t, rep, productId, await createJournalPhoto(db, t, rep));
    expect(milestone.status).toBe(201);
    expect(await drainTags()).toEqual([[`product:${productSlug}`, `trace:${traceCode}`]]);

    const published = await t.request({
      method: 'POST',
      url: `/products/${productId}/publish`,
      auth: rep.auth,
      headers: { 'if-match': '1' },
    });
    expect(published.status).toBe(200);
    expect(await drainTags()).toEqual([
      ['exhibition', `product:${productSlug}`, `trace:${traceCode}`, 'household:gom-revalidate'],
    ]);
  });

  it('suspension queues the tags in the same transaction as the decision, reinstatement too', async () => {
    const suspended = await decide('suspend', { reason: 'Đang xác minh lại giấy tờ' });
    expect(suspended.status).toBe(200);
    version = suspended.body.version;
    expect(await drainTags()).toEqual([['exhibition', 'household:gom-revalidate']]);

    const reinstated = await decide('reinstate');
    expect(reinstated.status).toBe(200);
    version = reinstated.body.version;
    expect(await drainTags()).toEqual([['exhibition', 'household:gom-revalidate']]);
  });

  it('a refused decision queues nothing', async () => {
    const stale = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/suspend`,
      auth: admin.auth,
      headers: { 'if-match': String(version + 9) },
      body: { reason: 'Đang xác minh lại giấy tờ' },
    });
    expect(stale.status).toBe(409);
    expect(await drainTags()).toEqual([]);
  });

  it('a slug change queues the old and the new household tag', async () => {
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    await drainTags();
    const updated = await t.request({
      method: 'PATCH',
      url: '/me/household',
      auth: rep.auth,
      headers: { 'if-match': `"${mine.body.version}"` },
      body: { slug: 'gom-revalidate-moi' },
    });
    expect(updated.status).toBe(200);
    version = updated.body.version;
    expect(await drainTags()).toEqual([
      ['exhibition', 'household:gom-revalidate', 'household:gom-revalidate-moi'],
    ]);
  });

  it('the relay delivers the tags to the web with the bearer secret, then marks the event DONE', async () => {
    await decide('suspend', { reason: 'Kiểm tra' }).then((r) => {
      expect(r.status).toBe(200);
      version = r.body.version;
    });
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    const config = webRevalidateFromEnv({
      WEB_REVALIDATE_URL: 'https://web.test/api/revalidate',
      REVALIDATE_SECRET: 'integration-secret',
    });
    const dispatch = createOutboxDispatcher(
      queues,
      Date.now,
      createWebRevalidator(config, fetchImpl as never),
    );
    await relayOutbox(db.orm, dispatch, 200);

    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    const suspension = calls.find(([, init]) =>
      String(init.body).includes('"household:gom-revalidate-moi"'),
    );
    expect(suspension?.[0]).toBe('https://web.test/api/revalidate');
    expect(((suspension?.[1].headers ?? {}) as Record<string, string>).authorization).toBe(
      'Bearer integration-secret',
    );
    expect(JSON.parse(String(suspension?.[1].body)).tags).toContain('exhibition');
    const left = await db.orm.em
      .fork()
      .count(OutboxEvent, { type: 'exhibition.changed', status: { $ne: 'DONE' } });
    expect(left).toBe(0);
  });

  it('a failed delivery is retried by the outbox; unset env sends nothing and still completes', async () => {
    const reinstated = await decide('reinstate');
    expect(reinstated.status).toBe(200);
    version = reinstated.body.version;

    const config = webRevalidateFromEnv({
      WEB_REVALIDATE_URL: 'https://web.test/api/revalidate',
      REVALIDATE_SECRET: 's',
    });
    const down = createOutboxDispatcher(
      queues,
      Date.now,
      createWebRevalidator(config, (async () => new Response('x', { status: 503 })) as never),
    );
    const result = await relayOutbox(db.orm, down, 200);
    expect(result.failed).toBeGreaterThan(0);
    const pending = await db.orm.em.fork().find(OutboxEvent, { type: 'exhibition.changed' });
    expect(pending.some((e) => e.status === 'PENDING' && e.attempts === 1)).toBe(true);

    // Make the retry due, then run it with the env unset: nothing is sent, the event completes.
    await db.orm.em
      .fork()
      .nativeUpdate(
        OutboxEvent,
        { type: 'exhibition.changed', status: 'PENDING' },
        { availableAt: new Date(Date.now() - 1000) },
      );
    const fetchImpl = vi.fn();
    const off = createOutboxDispatcher(
      queues,
      Date.now,
      createWebRevalidator(webRevalidateFromEnv({}), fetchImpl as never),
    );
    expect((await relayOutbox(db.orm, off, 200)).failed).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      await db.orm.em
        .fork()
        .count(OutboxEvent, { type: 'exhibition.changed', status: { $ne: 'DONE' } }),
    ).toBe(0);
  });
});
