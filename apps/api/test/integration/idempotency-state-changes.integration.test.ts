import { JournalEntry, MediaAsset, Product } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const SHA = 'b'.repeat(64);

/** Issue #348 (BR-L5): `Idempotency-Key` on product create, product duplicate and journal entries. */
describe('Idempotency-Key on studio state changes', () => {
  let db: TestDatabase;
  let t: TestApp;
  let rep: { id: string; auth: string };
  let productId: string;
  let photoUrl: string;

  const withKey = (key: string) => ({ 'idempotency-key': key });
  const productCount = () =>
    db.orm.em.fork().count(Product, { household: { representative: rep.id } });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    const admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Minh Châu', slug: 'gom-minh-chau' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    const em = db.orm.em.fork();
    const photo = em.create(MediaAsset, {
      ownerId: rep.id,
      purpose: 'JOURNAL',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 1,
      width: 1280,
      height: 800,
      sha256: SHA,
      originalKey: 'originals/clay',
      variants: [{ format: 'webp', width: 1280, height: 800, key: 'v/clay-1280.webp', bytes: 1 }],
    });
    await em.flush();
    const read = await t.request({ method: 'GET', url: `/media/${photo.id}`, auth: rep.auth });
    photoUrl = read.body.variants[0].url;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('creates one product for two creates with the same key and returns the same body', async () => {
    const send = () =>
      t.request({
        method: 'POST',
        url: '/me/household/products',
        auth: rep.auth,
        body: { name: 'Chén tống men rạn' },
        headers: withKey('product-create-1'),
      });
    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await productCount()).toBe(1);
    productId = first.body.id;
  });

  it('creates a product per call when no key is sent', async () => {
    const before = await productCount();
    const send = () =>
      t.request({
        method: 'POST',
        url: '/me/household/products',
        auth: rep.auth,
        body: { name: 'Bình hoa' },
      });
    await send();
    await send();
    expect(await productCount()).toBe(before + 2);
  });

  it('makes one copy for two duplicates with the same key', async () => {
    const before = await productCount();
    const send = () =>
      t.request({
        method: 'POST',
        url: `/me/household/products/${productId}/duplicate`,
        auth: rep.auth,
        headers: withKey('product-duplicate-1'),
      });
    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.id).toBe(first.body.id);
    expect(await productCount()).toBe(before + 1);
  });

  it('adds one journal entry for two appends with the same key', async () => {
    const send = () =>
      t.request({
        method: 'POST',
        url: `/me/household/products/${productId}/journal`,
        auth: rep.auth,
        body: {
          stage: 'clay',
          declaredDate: '2026-09-02',
          note: 'Lọc đất sông Hồng.',
          images: [{ url: photoUrl, sha256: SHA }],
        },
        headers: withKey('journal-append-1'),
      });
    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await db.orm.em.fork().count(JournalEntry, { product: productId })).toBe(1);
  });
});
