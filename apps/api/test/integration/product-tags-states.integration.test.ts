import { AuditLog, Household, Product } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMilestone, createJournalPhoto } from './support/journal-photo.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

interface ProductBody {
  id: string;
  version: number;
  slug: string;
  traceCode: string;
  status: string;
  stock: number;
  priceVnd: number;
  tags: string[];
}

/**
 * GH#253 (FR-PRD-01, 06, 07): product tags, the SOLD lifecycle state, duplication without the journal
 * and the median price suggestion, over HTTP on a real database.
 */
describe('Product tags, sold state, duplication and price suggestion', () => {
  let db: TestDatabase;
  let t: TestApp;
  let rep: { id: string; auth: string };
  let other: { id: string; auth: string };
  let admin: { auth: string };
  let buyer: { auth: string };

  async function create(body: Record<string, unknown>): Promise<ProductBody> {
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body,
    });
    expect(created.status).toBe(201);
    return created.body;
  }

  async function publish(product: ProductBody): Promise<ProductBody> {
    expect(
      (await addMilestone(t, rep, product.id, await createJournalPhoto(db, t, rep))).status,
    ).toBe(201);
    const res = await t.request({
      method: 'POST',
      url: `/products/${product.id}/publish`,
      auth: rep.auth,
      headers: { 'if-match': `"${product.version}"` },
    });
    expect(res.status).toBe(200);
    return res.body;
  }

  const act = (product: ProductBody, action: string, auth = rep.auth, body?: object) =>
    t.request({
      method: 'POST',
      url: `/products/${product.id}/${action}`,
      auth,
      headers: { 'if-match': `"${product.version}"` },
      ...(body && { body }),
    });

  const catalog = (query: string) => t.request({ method: 'GET', url: `/products?${query}` });
  const slugs = (res: { body: { data: { slug: string }[] } }) => res.body.data.map((p) => p.slug);

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    rep = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    for (const [user, slug] of [
      [rep, 'gom-tag-a'],
      [other, 'gom-tag-b'],
    ] as const) {
      const applied = await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hộ ${slug}`, slug, history: '' },
      });
      expect(applied.status).toBe(201);
    }
    await db.orm.em
      .fork()
      .nativeUpdate(
        Household,
        { slug: { $in: ['gom-tag-a', 'gom-tag-b'] } },
        { status: 'APPROVED' },
      );
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  describe('tags', () => {
    let tagged: ProductBody;

    it('normalizes tags on create: trimmed, case-insensitive duplicates dropped, diacritics kept', async () => {
      tagged = await create({
        name: 'Bình trà thủ công',
        category: 'TEA',
        priceVnd: 300_000,
        stock: 1,
        tags: ['  Gốm Bát Tràng ', 'gốm bát tràng', 'Men  lam'],
      });
      expect(tagged.tags).toEqual(['Gốm Bát Tràng', 'Men lam']);
    });

    it('replaces the tags on update and clears them with an empty list', async () => {
      const patch = (body: object, version: number) =>
        t.request({
          method: 'PATCH',
          url: `/me/household/products/${tagged.id}`,
          auth: rep.auth,
          headers: { 'if-match': `"${version}"` },
          body,
        });
      const updated = await patch({ tags: ['Sơn mài', 'thủ công'] }, tagged.version);
      expect(updated.status).toBe(200);
      expect(updated.body.tags).toEqual(['Sơn mài', 'thủ công']);
      const kept = await patch({ priceVnd: 310_000 }, updated.body.version);
      expect(kept.body.tags).toEqual(['Sơn mài', 'thủ công']);
      const cleared = await patch({ tags: [] }, kept.body.version);
      expect(cleared.body.tags).toEqual([]);
      const restored = await patch({ tags: ['Gốm Bát Tràng', 'men lam'] }, cleared.body.version);
      tagged = restored.body;
      expect(tagged.tags).toEqual(['Gốm Bát Tràng', 'men lam']);
    });

    it('rejects more than 10 tags, an empty tag and a tag over 30 characters', async () => {
      const patch = (tags: string[]) =>
        t.request({
          method: 'PATCH',
          url: `/me/household/products/${tagged.id}`,
          auth: rep.auth,
          headers: { 'if-match': `"${tagged.version}"` },
          body: { tags },
        });
      expect((await patch(Array.from({ length: 11 }, (_, i) => `tag ${i}`))).status).toBe(422);
      expect((await patch(['ok', '   '])).status).toBe(422);
      expect((await patch(['x'.repeat(31)])).status).toBe(422);
      expect((await patch(Array.from({ length: 10 }, (_, i) => `tag ${i}`))).status).toBe(200);
      tagged = (
        await t.request({ method: 'GET', url: '/me/household', auth: rep.auth })
      ).body.products.find((p: ProductBody) => p.id === tagged.id);
    });

    it('shows the tags on the public product page and finds the product by tag, without diacritics', async () => {
      const restore = await t.request({
        method: 'PATCH',
        url: `/me/household/products/${tagged.id}`,
        auth: rep.auth,
        headers: { 'if-match': `"${tagged.version}"` },
        body: { tags: ['Gốm Bát Tràng', 'men lam'] },
      });
      tagged = await publish(restore.body);
      const page = await t.request({ method: 'GET', url: `/products/${tagged.slug}` });
      expect(page.status).toBe(200);
      expect(page.body.product.tags).toEqual(['Gốm Bát Tràng', 'men lam']);

      // The name has neither word: only the tag matches.
      expect(slugs(await catalog('q=gom%20bat%20trang'))).toEqual([tagged.slug]);
      expect(slugs(await catalog('q=G%E1%BB%91m%20B%C3%A1t'))).toEqual([tagged.slug]);
      expect(slugs(await catalog('q=men%20lam'))).toEqual([tagged.slug]);
      expect(slugs(await catalog('q=khong-co-the-nay'))).toEqual([]);

      const suggest = await t.request({ method: 'GET', url: '/search/suggest?q=gom%20bat' });
      expect(suggest.status).toBe(200);
      expect(suggest.body.products.map((p: { slug: string }) => p.slug)).toEqual([tagged.slug]);
      const card = (await catalog('q=men%20lam')).body.data[0];
      expect(card.tags).toEqual(['Gốm Bát Tràng', 'men lam']);
    });

    it('stops matching a tag once it is removed', async () => {
      const removed = await t.request({
        method: 'PATCH',
        url: `/me/household/products/${tagged.id}`,
        auth: rep.auth,
        headers: { 'if-match': `"${tagged.version}"` },
        body: { tags: ['men lam'] },
      });
      expect(removed.status).toBe(200);
      tagged = removed.body;
      expect(slugs(await catalog('q=gom%20bat%20trang'))).toEqual([]);
      expect(slugs(await catalog('q=men%20lam'))).toEqual([tagged.slug]);
    });
  });

  describe('sold state', () => {
    let piece: ProductBody;
    let batch: ProductBody;
    let draft: ProductBody;

    beforeAll(async () => {
      piece = await publish(
        await create({ name: 'Bình độc bản sold', category: 'VASE', priceVnd: 900_000, stock: 1 }),
      );
      batch = await publish(
        await create({
          name: 'Lô cốc sold',
          category: 'TABLEWARE',
          kind: 'BATCH',
          batchSize: 20,
          priceVnd: 50_000,
          stock: 20,
        }),
      );
      draft = await create({ name: 'Bản nháp sold', category: 'VASE' });
    });

    it('refuses MARK_SOLD for a batch, a draft and anyone but the owner', async () => {
      const forBatch = await act(batch, 'mark-sold');
      expect(forBatch.status).toBe(409);
      expect(forBatch.body).toMatchObject({
        code: 'BUSINESS_RULE_VIOLATED',
        detail: 'NOT_ONE_OF_A_KIND',
      });
      expect((await act(draft, 'mark-sold')).status).toBe(409);
      expect((await act(piece, 'mark-sold', other.auth)).status).toBe(403);
      expect((await act(piece, 'mark-sold', admin.auth)).status).toBe(403);
      expect((await act(piece, 'mark-sold', buyer.auth)).status).toBe(403);
      const stale = await t.request({
        method: 'POST',
        url: `/products/${piece.id}/mark-sold`,
        auth: rep.auth,
        headers: { 'if-match': `"${piece.version + 3}"` },
      });
      expect(stale.status).toBe(409);
    });

    it('marks a one-of-a-kind piece sold: stock empties, page and trace stay visible', async () => {
      const sold = await act(piece, 'mark-sold');
      expect(sold.status).toBe(200);
      expect(sold.body).toMatchObject({ status: 'SOLD', stock: 0 });
      piece = sold.body;

      const page = await t.request({ method: 'GET', url: `/products/${piece.slug}` });
      expect(page.status).toBe(200);
      expect(page.body.product.status).toBe('SOLD');
      const trace = await t.request({ method: 'GET', url: `/trace/${piece.traceCode}` });
      expect(trace.status).toBe(200);
      expect(trace.body).toMatchObject({
        availability: 'VISIBLE',
        product: { status: 'SOLD' },
      });
      const household = await t.request({ method: 'GET', url: '/households/gom-tag-a' });
      expect(household.body.products.map((p: ProductBody) => p.slug)).toContain(piece.slug);
    });

    it('keeps a sold piece in the catalog with a sold status but outside the in-stock filter', async () => {
      const all = await catalog('limit=50');
      const card = all.body.data.find((p: { slug: string }) => p.slug === piece.slug);
      expect(card).toMatchObject({ status: 'SOLD', stock: 0 });
      expect(slugs(all)).toContain(batch.slug);
      expect(slugs(await catalog('inStock=true&limit=50'))).not.toContain(piece.slug);
      expect(slugs(await catalog('inStock=true&limit=50'))).toContain(batch.slug);
      expect(slugs(await catalog('inStock=false&limit=50'))).toContain(piece.slug);
      expect(slugs(await catalog('q=doc%20ban%20sold'))).toEqual([piece.slug]);
      const suggest = await t.request({ method: 'GET', url: '/search/suggest?q=doc%20ban%20sold' });
      expect(suggest.body.products.map((p: { slug: string }) => p.slug)).toEqual([piece.slug]);
    });

    it('puts the piece back on sale (undo), restoring one unit in stock', async () => {
      expect((await act(piece, 'back-on-sale', other.auth)).status).toBe(403);
      const back = await act(piece, 'back-on-sale');
      expect(back.status).toBe(200);
      expect(back.body).toMatchObject({ status: 'PUBLISHED', stock: 1 });
      piece = back.body;
      expect(slugs(await catalog('inStock=true&limit=50'))).toContain(piece.slug);
      // A published product cannot go "back on sale".
      expect((await act(piece, 'back-on-sale')).status).toBe(409);
    });

    it('lets the owner archive a sold piece with a reason, and hides it from the public', async () => {
      const sold = await act(piece, 'mark-sold');
      expect(sold.status).toBe(200);
      piece = sold.body;
      expect((await act(piece, 'withdraw', rep.auth, { reason: 'ab' })).status).toBe(422);
      const archived = await act(piece, 'withdraw', rep.auth, { reason: 'Giữ lại làm bộ sưu tập' });
      expect(archived.status).toBe(200);
      expect(archived.body.status).toBe('WITHDRAWN');
      expect((await t.request({ method: 'GET', url: `/products/${piece.slug}` })).status).toBe(404);
      const trace = await t.request({ method: 'GET', url: `/trace/${piece.traceCode}` });
      expect(trace.body).toMatchObject({
        availability: 'UNAVAILABLE',
        reason: 'PRODUCT_WITHDRAWN',
      });
    });
  });

  describe('duplication', () => {
    let source: ProductBody;
    let artisanId: string;

    beforeAll(async () => {
      const artisan = await t.request({
        method: 'POST',
        url: '/me/household/artisans',
        auth: rep.auth,
        body: { name: 'Nguyễn Văn Hải' },
      });
      artisanId = artisan.body.id;
      source = await create({
        name: 'Chén trà nhân bản',
        description: 'Chén men lam vẽ tay',
        category: 'TEA',
        priceVnd: 120_000,
        stock: 4,
        material: 'Đất sét',
        dimensions: '8 x 6 cm',
        weightGrams: 150,
        artisanNote: 'Làm vào mùa mưa',
        tags: ['chén', 'men lam'],
      });
      source = await publish(source);
      expect(
        (
          await t.request({
            method: 'PUT',
            url: `/me/household/products/${source.id}/makers`,
            auth: rep.auth,
            headers: { 'if-match': String(source.version) },
            body: { makers: [{ artisanId, contribution: 'Vuốt dáng' }] },
          })
        ).status,
      ).toBe(200);
    });

    const journal = (id: string, auth = rep.auth) =>
      t.request({ method: 'GET', url: `/me/household/products/${id}/journal`, auth });

    it('creates a DRAFT copy with the descriptive fields, a fresh trace code and slug, and no journal', async () => {
      const copied = await t.request({
        method: 'POST',
        url: `/me/household/products/${source.id}/duplicate`,
        auth: rep.auth,
      });
      expect(copied.status).toBe(201);
      expect(copied.body).toMatchObject({
        status: 'DRAFT',
        publishedAt: null,
        name: 'Chén trà nhân bản',
        description: 'Chén men lam vẽ tay',
        category: 'TEA',
        kind: 'OBJECT',
        priceVnd: 120_000,
        stock: 4,
        material: 'Đất sét',
        dimensions: '8 x 6 cm',
        weightGrams: 150,
        artisanNote: 'Làm vào mùa mưa',
        tags: ['chén', 'men lam'],
        makers: [],
      });
      expect(copied.body.id).not.toBe(source.id);
      expect(copied.body.traceCode).not.toBe(source.traceCode);
      expect(copied.body.slug).not.toBe(source.slug);
      expect(copied.body.slug).toBe(`chen-tra-nhan-ban-${copied.body.traceCode.toLowerCase()}`);

      expect((await journal(copied.body.id)).body.entries).toEqual([]);
      expect((await journal(source.id)).body.entries).toHaveLength(1);
      // The copy is private until it has its own journal and is published.
      expect(
        (await t.request({ method: 'GET', url: `/products/${copied.body.slug}` })).status,
      ).toBe(404);
      const publishCopy = await act(copied.body, 'publish');
      expect(publishCopy.status).toBe(409);
      expect(publishCopy.body.code).toBe('PRODUCT_JOURNAL_REQUIRED');
    });

    it('is for the owning household only', async () => {
      const url = `/me/household/products/${source.id}/duplicate`;
      expect((await t.request({ method: 'POST', url, auth: other.auth })).status).toBe(403);
      expect((await t.request({ method: 'POST', url, auth: buyer.auth })).status).toBe(403);
      expect((await t.request({ method: 'POST', url, auth: admin.auth })).status).toBe(403);
      expect((await t.request({ method: 'POST', url })).status).toBe(401);
      const missing = await t.request({
        method: 'POST',
        url: '/me/household/products/00000000-0000-4000-8000-000000000000/duplicate',
        auth: rep.auth,
      });
      expect(missing.status).toBe(404);
    });
  });

  describe('price suggestion', () => {
    const suggestion = (category: string, auth = rep.auth) =>
      t.request({
        method: 'GET',
        url: `/me/household/products/price-suggestion?category=${category}`,
        auth,
      });

    it('is hidden (null) below 3 comparable published products', async () => {
      await publish(await create({ name: 'Cây sơn 1', category: 'WORSHIP', priceVnd: 100_000 }));
      await publish(await create({ name: 'Cây sơn 2', category: 'WORSHIP', priceVnd: 200_000 }));
      const res = await suggestion('WORSHIP');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ category: 'WORSHIP', suggestion: null });
    });

    it('is the median with its sample size, counting only listed prices of published products', async () => {
      // A published product of another household counts too.
      const otherProduct = await t.request({
        method: 'POST',
        url: '/me/household/products',
        auth: other.auth,
        body: { name: 'Cây sơn 3', category: 'WORSHIP', priceVnd: 600_000 },
      });
      expect(otherProduct.status).toBe(201);
      expect(
        (
          await addMilestone(
            t,
            other,
            otherProduct.body.id,
            await createJournalPhoto(db, t, other, 'b'.repeat(64)),
          )
        ).status,
      ).toBe(201);
      expect(
        (
          await t.request({
            method: 'POST',
            url: `/products/${otherProduct.body.id}/publish`,
            auth: other.auth,
            headers: { 'if-match': `"${otherProduct.body.version}"` },
          })
        ).status,
      ).toBe(200);

      // None of these counts: a draft, an unlisted price (0) and another category.
      await create({ name: 'Nháp sơn', category: 'WORSHIP', priceVnd: 9_000_000 });
      await publish(await create({ name: 'Cây sơn chưa giá', category: 'WORSHIP', priceVnd: 0 }));
      await publish(
        await create({ name: 'Bình khác loại', category: 'DECOR', priceVnd: 7_000_000 }),
      );

      const res = await suggestion('WORSHIP');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        category: 'WORSHIP',
        suggestion: { medianVnd: 200_000, count: 3 },
      });
      expect((await suggestion('WORSHIP', other.auth)).body.suggestion).toEqual({
        medianVnd: 200_000,
        count: 3,
      });
    });

    it('averages the two middle prices for an even sample and ignores a sold piece', async () => {
      const piece = await publish(
        await create({ name: 'Cây sơn độc bản', category: 'WORSHIP', priceVnd: 400_000 }),
      );
      // 100k, 200k, 400k, 600k: the median is 300k.
      expect((await suggestion('WORSHIP')).body.suggestion).toEqual({
        medianVnd: 300_000,
        count: 4,
      });
      expect((await act(piece, 'mark-sold')).status).toBe(200);
      expect((await suggestion('WORSHIP')).body.suggestion).toEqual({
        medianVnd: 200_000,
        count: 3,
      });
    });

    it('is for signed-in households with a valid category and never changes a price', async () => {
      expect((await suggestion('WORSHIP', buyer.auth)).status).toBe(403);
      expect((await suggestion('WORSHIP', admin.auth)).status).toBe(403);
      expect(
        (
          await t.request({
            method: 'GET',
            url: '/me/household/products/price-suggestion?category=WORSHIP',
          })
        ).status,
      ).toBe(401);
      expect((await suggestion('NOPE')).status).toBe(422);
      const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
      const prices = mine.body.products
        .filter((p: { name: string }) => p.name === 'Cây sơn 1')
        .map((p: { priceVnd: number }) => p.priceVnd);
      expect(prices).toEqual([100_000]);
    });
  });

  describe('board withdrawal (GH#428)', () => {
    let piece: ProductBody;

    beforeAll(async () => {
      piece = await publish(
        await create({ name: 'Bình bị gỡ', category: 'TEA', priceVnd: 200_000, stock: 1 }),
      );
    });

    it('records the board as the one who withdrew and blocks the owner from republishing', async () => {
      const withdrawn = await act(piece, 'withdraw', admin.auth, { reason: 'Counterfeit listing' });
      expect(withdrawn.status).toBe(200);
      expect(withdrawn.body).toMatchObject({
        status: 'WITHDRAWN',
        withdrawnBy: 'BOARD',
        withdrawnReason: 'Counterfeit listing',
      });
      piece = withdrawn.body;
      const refused = await act(piece, 'republish');
      expect(refused.status).toBe(409);
      expect(refused.body.code).toBe('PRODUCT_WITHDRAWN_BY_BOARD');
      const stored = await db.orm.em.fork().findOneOrFail(Product, piece.id);
      expect(stored.status).toBe('WITHDRAWN');
    });

    it('lets the board republish and writes an audit entry', async () => {
      expect((await act(piece, 'republish', other.auth)).status).toBe(403);
      const back = await act(piece, 'republish', admin.auth);
      expect(back.status).toBe(200);
      expect(back.body).toMatchObject({ status: 'PUBLISHED', withdrawnBy: null });
      piece = back.body;
      const audit = await db.orm.em
        .fork()
        .find(AuditLog, { action: 'product.republish', entityId: piece.id });
      expect(audit).toHaveLength(1);
    });

    it('still lets the owner republish a product the owner withdrew', async () => {
      const own = await act(piece, 'withdraw', rep.auth, { reason: 'Seasonal break' });
      expect(own.status).toBe(200);
      expect(own.body).toMatchObject({ status: 'WITHDRAWN', withdrawnBy: 'OWNER' });
      const back = await act(own.body, 'republish');
      expect(back.status).toBe(200);
      expect(back.body.status).toBe('PUBLISHED');
      // The board cannot republish what the owner withdrew.
      const again = await act(back.body, 'withdraw', rep.auth, { reason: 'Seasonal break' });
      expect((await act(again.body, 'republish', admin.auth)).status).toBe(409);
    });
  });
});
