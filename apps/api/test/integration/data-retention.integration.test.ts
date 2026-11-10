import {
  LoginEvent,
  Product,
  purgeLoginEvents,
  purgeTraceScans,
  TraceScan,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const DAY_MS = 86_400_000;

/** GH#419: sign-in history is kept 12 months and QR scans 24 months. */
describe('Data retention jobs', () => {
  let db: TestDatabase;
  let t: TestApp;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('deletes login events older than 12 months and keeps newer ones', async () => {
    const user = await t.createUser('BUYER');
    const now = new Date();
    const em = db.orm.em.fork();
    const old = em.create(LoginEvent, {
      userId: user.id,
      sessionId: 'retention-old',
      method: 'password',
      aal: 'aal1',
    });
    const recent = em.create(LoginEvent, {
      userId: user.id,
      sessionId: 'retention-recent',
      method: 'password',
      aal: 'aal1',
    });
    await em.flush();
    await em.nativeUpdate(
      LoginEvent,
      { id: old.id },
      { createdAt: new Date(now.getTime() - 400 * DAY_MS) },
    );
    await em.nativeUpdate(
      LoginEvent,
      { id: recent.id },
      { createdAt: new Date(now.getTime() - 300 * DAY_MS) },
    );

    expect(await purgeLoginEvents(db.orm, now)).toBe(1);
    const left = await db.orm.em.fork().find(LoginEvent, { userId: user.id });
    expect(left.map((event) => event.id)).toEqual([recent.id]);
  });

  it('deletes trace scans older than 24 months and keeps newer ones', async () => {
    const admin = await t.createUser('ADMIN');
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Retention household', slug: 'retention-household', history: 'History' },
    });
    expect(applied.status).toBe(201);
    await t.request({
      method: 'POST',
      url: '/me/household/workshops',
      auth: rep.auth,
      body: { name: 'Workshop', address: 'Workshop Lane' },
    });
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
    expect(approved.status).toBe(200);
    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Retention vase' },
    });
    expect(product.status).toBe(201);

    const now = new Date();
    const em = db.orm.em.fork();
    const reference = em.getReference(Product, product.body.id as string);
    const old = em.create(TraceScan, { product: reference });
    const recent = em.create(TraceScan, { product: reference });
    await em.flush();
    await em.nativeUpdate(
      TraceScan,
      { id: old.id },
      { createdAt: new Date(now.getTime() - 800 * DAY_MS) },
    );
    await em.nativeUpdate(
      TraceScan,
      { id: recent.id },
      { createdAt: new Date(now.getTime() - 600 * DAY_MS) },
    );

    expect(await purgeTraceScans(db.orm, now)).toBe(1);
    const left = await db.orm.em.fork().find(TraceScan, {});
    expect(left.map((scan) => scan.id)).toEqual([recent.id]);
  });
});
