import { Household, Product } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#254 (FR-CAT-08, FR-CAT-07): the optional English product fields (save, public DTO, search,
 * duplication) and the signed-in favourites list, over HTTP on a real database.
 */
describe('English product fields and favourites', () => {
  let db: TestDatabase;
  let t: TestApp;
  let rep: { id: string; auth: string };
  let householdId: string;
  let buyer: { auth: string };
  let otherBuyer: { auth: string };

  async function create(body: Record<string, unknown>) {
    const res = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body,
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; version: number; slug: string };
  }

  const publishDirectly = (id: string) =>
    db.orm.em
      .fork()
      .nativeUpdate(Product, { id }, { status: 'PUBLISHED', publishedAt: new Date() });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Anh Ngữ', slug: 'gom-anh-ngu', history: 'Nhiều đời.' },
    });
    expect(applied.status).toBe(201);
    householdId = applied.body.id;
    await db.orm.em.fork().nativeUpdate(Household, { id: householdId }, { status: 'APPROVED' });
    buyer = await t.createUser('BUYER');
    otherBuyer = await t.createUser('BUYER');
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  describe('English fields', () => {
    it('saves them on create and update, and clears an empty one', async () => {
      const product = await create({
        name: 'Bình hút lộc',
        description: 'Men lam.',
        material: 'Đất sét',
        dimensions: 'Cao 32 cm',
        nameEn: 'Fortune vase',
        descriptionEn: 'Blue glaze.',
        materialEn: 'Clay',
        dimensionsEn: 'Height 32 cm',
      });
      const first = await t.request({
        method: 'GET',
        url: '/me/household',
        auth: rep.auth,
      });
      expect(first.status).toBe(200);
      const mine = first.body.products.find((p: { id: string }) => p.id === product.id);
      expect(mine).toMatchObject({
        nameEn: 'Fortune vase',
        descriptionEn: 'Blue glaze.',
        materialEn: 'Clay',
        dimensionsEn: 'Height 32 cm',
      });

      const updated = await t.request({
        method: 'PATCH',
        url: `/me/household/products/${product.id}`,
        auth: rep.auth,
        headers: { 'if-match': `"${product.version}"` },
        body: { nameEn: 'Lucky vase', materialEn: '' },
      });
      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        nameEn: 'Lucky vase',
        descriptionEn: 'Blue glaze.',
        materialEn: null,
        dimensionsEn: 'Height 32 cm',
      });
    });

    it('returns them in the public card, detail and suggestions, and finds the product by its English name', async () => {
      const product = await create({
        name: 'Ấm chén xanh',
        nameEn: 'Celadon teapot',
        descriptionEn: 'A teapot with two cups.',
        materialEn: 'Porcelain',
        dimensionsEn: '450 ml',
      });
      await publishDirectly(product.id);

      const list = await t.request({ method: 'GET', url: '/products?q=celadon' });
      expect(list.status).toBe(200);
      expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([product.id]);
      expect(list.body.data[0].nameEn).toBe('Celadon teapot');

      const detail = await t.request({ method: 'GET', url: `/products/${product.slug}` });
      expect(detail.status).toBe(200);
      expect(detail.body.product).toMatchObject({
        nameEn: 'Celadon teapot',
        descriptionEn: 'A teapot with two cups.',
        materialEn: 'Porcelain',
        dimensionsEn: '450 ml',
      });

      const suggest = await t.request({ method: 'GET', url: '/search/suggest?q=celadon' });
      expect(suggest.body.products).toEqual([
        expect.objectContaining({ name: 'Ấm chén xanh', nameEn: 'Celadon teapot' }),
      ]);
    });

    it('copies them when a product is duplicated', async () => {
      const product = await create({
        name: 'Đĩa men rạn',
        nameEn: 'Crackle plate',
        descriptionEn: 'Crackle glaze.',
        materialEn: 'Stoneware',
        dimensionsEn: 'Diameter 16 cm',
      });
      const copy = await t.request({
        method: 'POST',
        url: `/me/household/products/${product.id}/duplicate`,
        auth: rep.auth,
      });
      expect(copy.status).toBe(201);
      expect(copy.body).toMatchObject({
        nameEn: 'Crackle plate',
        descriptionEn: 'Crackle glaze.',
        materialEn: 'Stoneware',
        dimensionsEn: 'Diameter 16 cm',
      });
    });
  });

  describe('favourites', () => {
    const call = (method: 'GET' | 'PUT' | 'DELETE', url: string, auth?: string) =>
      t.request({ method, url, ...(auth ? { auth } : {}) });

    it('requires a signed-in account', async () => {
      expect((await call('GET', '/me/favourites')).status).toBe(401);
      expect((await call('PUT', `/me/favourites/${householdId}`)).status).toBe(401);
      expect((await call('DELETE', `/me/favourites/${householdId}`)).status).toBe(401);
    });

    it('saves idempotently, lists cards and removes idempotently, per user', async () => {
      const product = await create({ name: 'Bát trà', nameEn: 'Tea bowl' });
      await publishDirectly(product.id);

      expect((await call('PUT', `/me/favourites/${product.id}`, buyer.auth)).status).toBe(204);
      expect((await call('PUT', `/me/favourites/${product.id}`, buyer.auth)).status).toBe(204);

      const mine = await call('GET', '/me/favourites', buyer.auth);
      expect(mine.status).toBe(200);
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0]).toMatchObject({ id: product.id, nameEn: 'Tea bowl' });

      const theirs = await call('GET', '/me/favourites', otherBuyer.auth);
      expect(theirs.body.data).toEqual([]);

      expect((await call('DELETE', `/me/favourites/${product.id}`, buyer.auth)).status).toBe(204);
      expect((await call('DELETE', `/me/favourites/${product.id}`, buyer.auth)).status).toBe(204);
      expect((await call('GET', '/me/favourites', buyer.auth)).body.data).toEqual([]);
    });

    it('refuses a draft or unknown product and hides a saved product once it is withdrawn', async () => {
      const draft = await create({ name: 'Bản nháp' });
      expect((await call('PUT', `/me/favourites/${draft.id}`, buyer.auth)).status).toBe(404);
      expect(
        (await call('PUT', '/me/favourites/00000000-0000-4000-8000-000000000001', buyer.auth))
          .status,
      ).toBe(404);
      expect((await call('PUT', '/me/favourites/not-a-uuid', buyer.auth)).status).toBe(404);

      const product = await create({ name: 'Lọ sẽ bị rút' });
      await publishDirectly(product.id);
      await call('PUT', `/me/favourites/${product.id}`, buyer.auth);
      expect(
        (await call('GET', '/me/favourites', buyer.auth)).body.data.map(
          (p: { id: string }) => p.id,
        ),
      ).toContain(product.id);

      await db.orm.em.fork().nativeUpdate(Product, { id: product.id }, { status: 'WITHDRAWN' });
      expect(
        (await call('GET', '/me/favourites', buyer.auth)).body.data.map(
          (p: { id: string }) => p.id,
        ),
      ).not.toContain(product.id);
    });

    it('lets a guest fetch cards by ids for the local list', async () => {
      const product = await create({ name: 'Chén ngoài danh sách' });
      await publishDirectly(product.id);
      const res = await call('GET', `/products?ids=${product.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((p: { id: string }) => p.id)).toEqual([product.id]);
      expect((await call('GET', '/products?ids=nope')).status).toBe(422);
    });
  });
});
