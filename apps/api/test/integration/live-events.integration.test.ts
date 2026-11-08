import { LiveEventSchema } from '@vcraft/contracts';
import { MediaAsset, Notification } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#93: `GET /me/events` streams SSE for the signed-in account. The stream is time-boxed (here to 4 s
 * with `LIVE_EVENTS_MAX_MS`) and sees a notice written while it is open, as the worker would write one.
 */
describe('Live events stream', () => {
  let db: TestDatabase;
  let t: TestApp;
  let buyer: { id: string; auth: string };

  beforeAll(async () => {
    process.env.LIVE_EVENTS_MAX_MS = '4000';
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    buyer = await t.createUser('BUYER');
  }, 240_000);

  afterAll(async () => {
    delete process.env.LIVE_EVENTS_MAX_MS;
    await t?.close();
    await db?.stop();
  });

  it('needs a session', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/v1/me/events' });
    expect(res.statusCode).toBe(401);
  });

  it('announces the stream, then pushes the unread count and new activity', async () => {
    const pending = t.app.inject({
      method: 'GET',
      url: '/api/v1/me/events',
      headers: { authorization: buyer.auth },
    });
    // A notice lands while the stream is open (written straight to the database, like the worker does).
    setTimeout(() => {
      const em = db.orm.em.fork();
      em.create(Notification, {
        recipientId: buyer.id,
        type: 'HOUSEHOLD_APPROVED',
        subjectId: null,
      });
      void em.flush();
    }, 1_000);
    const res = await pending;
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    const events = res.body
      .split('\n\n')
      .flatMap((block) => block.split('\n').filter((l) => l.startsWith('data: ')))
      .map((l) => LiveEventSchema.parse(JSON.parse(l.slice(6))));
    expect(events[0]).toEqual({ type: 'ready', retryMs: 2000 });
    expect(events[1]).toEqual({ type: 'notifications', unreadCount: 0 });
    expect(events).toContainEqual({ type: 'notifications', unreadCount: 1 });
    expect(events.some((e) => e.type === 'activity')).toBe(true);
  }, 20_000);

  it('pushes media.updated when the worker finishes or fails a photo (GH#252)', async () => {
    const em = db.orm.em.fork();
    const make = (sha256: string) =>
      em.create(MediaAsset, {
        ownerId: buyer.id,
        purpose: 'JOURNAL',
        visibility: 'PUBLIC',
        status: 'PROCESSING',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
        sha256,
        originalKey: `originals/${sha256}`,
      });
    const good = make('1'.repeat(64));
    const bad = make('2'.repeat(64));
    const stranger = em.create(MediaAsset, {
      ownerId: crypto.randomUUID(),
      purpose: 'JOURNAL',
      visibility: 'PUBLIC',
      status: 'PROCESSING',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
      sha256: '3'.repeat(64),
      originalKey: 'originals/other',
    });
    await em.flush();

    const pending = t.app.inject({
      method: 'GET',
      url: '/api/v1/me/events',
      headers: { authorization: buyer.auth },
    });
    // The worker marks them while the stream is open.
    setTimeout(() => {
      good.status = 'READY';
      good.width = 1280;
      good.height = 800;
      good.thumbhash = 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rg==';
      good.variants = [
        { format: 'webp', width: 1280, height: 800, key: 'v/good-1280.webp', bytes: 1 },
      ];
      bad.status = 'FAILED';
      stranger.status = 'READY';
      void em.flush();
    }, 1_000);
    const res = await pending;
    const events = res.body
      .split('\n\n')
      .flatMap((block) => block.split('\n').filter((l) => l.startsWith('data: ')))
      .map((l) => LiveEventSchema.parse(JSON.parse(l.slice(6))));
    const media = events.filter((e) => e.type === 'media.updated');
    expect(media.map((e) => [e.id, e.status])).toEqual(
      expect.arrayContaining([
        [good.id, 'READY'],
        [bad.id, 'FAILED'],
      ]),
    );
    expect(media.some((e) => e.id === stranger.id)).toBe(false);
    expect(media.find((e) => e.id === good.id)).toMatchObject({
      url: expect.stringContaining('v/good-1280.webp'),
      thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rg==',
      width: 1280,
      height: 800,
    });
    expect(media.find((e) => e.id === bad.id)).toMatchObject({ url: null, variants: [] });
    // Each photo is announced once per stream.
    expect(media.filter((e) => e.id === good.id)).toHaveLength(1);
  }, 20_000);
});
