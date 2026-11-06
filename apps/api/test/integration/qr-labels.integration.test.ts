import { OutboxEvent } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #88: a household asks for a QR label sheet, the request goes to the worker through the outbox,
 * and the status turns READY with a presigned link once the PDF is in the private bucket.
 */
describe('QR label sheets', () => {
  let db: TestDatabase;
  let t: TestApp;
  let owner: { auth: string };
  let other: { auth: string };
  let householdId: string;
  let products: Array<{ id: string; traceCode: string }>;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    for (const [user, slug] of [
      [owner, 'gom-nhan-qr'],
      [other, 'gom-khac'],
    ] as const) {
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hộ ${slug}`, slug, history: '' },
      });
      if (user === owner) householdId = applied.body.id;
    }
    products = [];
    for (const name of ['Bình men lam', 'Ấm men nâu']) {
      const created = await t.request({
        method: 'POST',
        url: '/me/household/products',
        auth: owner.auth,
        body: { name },
      });
      products.push(created.body);
    }
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('queues the sheet through the outbox with each code repeated per copy', async () => {
    const res = await t.request({
      method: 'POST',
      url: '/me/household/qr-labels',
      auth: owner.auth,
      body: { productIds: products.map((p) => p.id), copies: 2 },
    });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ status: 'PENDING', url: null });
    const events = await db.orm.em.fork().find(OutboxEvent, { type: 'qr.labels.requested' });
    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toEqual({
      requestId: res.body.requestId,
      householdId,
      codes: [
        products[0]?.traceCode,
        products[0]?.traceCode,
        products[1]?.traceCode,
        products[1]?.traceCode,
      ],
    });

    const pending = await t.request({
      method: 'GET',
      url: `/me/household/qr-labels/${res.body.requestId}`,
      auth: owner.auth,
    });
    expect(pending.body.status).toBe('PENDING');

    // What the worker does once it has rendered the sheet.
    await t.storage.put({
      bucket: 'private',
      key: `qr-labels/${householdId}/${res.body.requestId}.pdf`,
      body: new TextEncoder().encode('%PDF-1.7'),
      contentType: 'application/pdf',
    });
    const ready = await t.request({
      method: 'GET',
      url: `/me/household/qr-labels/${res.body.requestId}`,
      auth: owner.auth,
    });
    expect(ready.body.status).toBe('READY');
    expect(typeof ready.body.url).toBe('string');

    // Another household cannot read it: the key is scoped to the caller's own household.
    const foreign = await t.request({
      method: 'GET',
      url: `/me/household/qr-labels/${res.body.requestId}`,
      auth: other.auth,
    });
    expect(foreign.body.status).toBe('PENDING');
  });

  it('refuses products of another household and oversized requests', async () => {
    const foreign = await t.request({
      method: 'POST',
      url: '/me/household/qr-labels',
      auth: other.auth,
      body: { productIds: [products[0]?.id] },
    });
    expect(foreign.status).toBe(403);
    const tooMany = await t.request({
      method: 'POST',
      url: '/me/household/qr-labels',
      auth: owner.auth,
      body: { productIds: products.map((p) => p.id), copies: 300 },
    });
    expect(tooMany.status).toBe(422);
  });
});
