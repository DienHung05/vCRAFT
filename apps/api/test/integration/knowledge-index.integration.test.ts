import { OutboxEvent, publicDocuments } from '@vcraft/database';
import { HashingEmbedder, InMemoryVectorStore, indexDocument } from '@vcraft/knowledge';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #79: changes to public content queue `knowledge.changed`, and only public content becomes a
 * knowledge document. Runs on PostgreSQL and MySQL: the index itself lives apart (Supabase pgvector, or
 * in memory here), so the business database stays portable (ADR-13).
 */
describe('Knowledge index sources', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let rep: { auth: string };
  let householdId: string;
  let product: { id: string; version: number };

  const events = async () =>
    (await db.orm.em.fork().find(OutboxEvent, { type: 'knowledge.changed' })).map((e) => e.payload);
  const docs = (type: 'PRODUCT' | 'HOUSEHOLD' | 'NEWS', id: string) =>
    publicDocuments(db.orm.em.fork(), type, id);

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
      body: {
        name: 'Gốm Tri Thức',
        slug: 'gom-tri-thuc',
        history: 'Ba đời làm men lam ở Bát Tràng.',
      },
    });
    householdId = applied.body.id;
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình men lam vẽ sen', description: 'Bình vẽ tay hoa sen, men lam.' },
    });
    product = created.body;
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('keeps a pending household and its draft product out of the index', async () => {
    expect(await docs('HOUSEHOLD', householdId)).toEqual([]);
    expect(await docs('PRODUCT', product.id)).toEqual([]);
  });

  it('queues a change on approval and publication, and indexes the public documents', async () => {
    const household = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(household.body.version) },
    });
    const published = await t.request({
      method: 'POST',
      url: `/products/${product.id}/publish`,
      auth: rep.auth,
      headers: { 'if-match': String(product.version) },
    });
    expect(published.status).toBe(200);
    product = published.body;
    expect(await events()).toEqual(
      expect.arrayContaining([
        { sourceType: 'HOUSEHOLD', sourceId: householdId },
        { sourceType: 'PRODUCT', sourceId: product.id },
      ]),
    );

    const [doc] = await docs('PRODUCT', product.id);
    expect(doc).toMatchObject({ locale: 'vi', url: expect.stringMatching(/^\/vi\/san-pham\//) });
    expect(doc?.title).toContain('Gốm Tri Thức');
    expect((await docs('HOUSEHOLD', householdId))[0]?.text).toContain('Ba đời làm men lam');

    const store = new InMemoryVectorStore();
    const embedder = new HashingEmbedder();
    await indexDocument(store, embedder, doc as NonNullable<typeof doc>);
    const [query] = await embedder.embed(['binh men lam ve sen']);
    expect((await store.search(query as number[], { limit: 1 }))[0]?.sourceId).toBe(product.id);
  });

  it('drops a withdrawn product and keeps village-only news out', async () => {
    const withdrawn = await t.request({
      method: 'POST',
      url: `/products/${product.id}/withdraw`,
      auth: rep.auth,
      headers: { 'if-match': String(product.version) },
      body: { reason: 'Hết hàng' },
    });
    expect(withdrawn.status).toBe(200);
    expect(await docs('PRODUCT', product.id)).toEqual([]);

    const news = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: {
        title: 'Tin nội bộ',
        summary: 'Chỉ cho hộ',
        bodyHtml: '<p>Họp làng.</p>',
        category: 'VILLAGE_EVENT',
        visibility: 'VILLAGE',
        pinned: false,
        important: false,
        status: 'PUBLISHED',
      },
    });
    expect(news.status).toBe(201);
    expect(await events()).toContainEqual({ sourceType: 'NEWS', sourceId: news.body.id });
    expect(await docs('NEWS', news.body.id)).toEqual([]);
  });
});
