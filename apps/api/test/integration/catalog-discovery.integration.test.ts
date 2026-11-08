import { Household, News, Product, TraceScan, Workshop } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#254 (FR-CAT-02, FR-CAT-04): the `openWorkshop` filter, the `popular` sort, category names in
 * search and suggestions, and the short cache on suggestions, over HTTP on a real database.
 */
describe('Catalog discovery', () => {
  let db: TestDatabase;
  let t: TestApp;

  const names = (res: { body: { data: { name: string }[] } }) => res.body.data.map((p) => p.name);
  const day = (offset: number) => new Date(Date.UTC(2026, 5, 1 + offset));
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  async function approvedHousehold(name: string, slug: string) {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name, slug, history: 'Nhiều đời.' },
    });
    expect(applied.status).toBe(201);
    await db.orm.em.fork().nativeUpdate(Household, { id: applied.body.id }, { status: 'APPROVED' });
    return { rep, id: applied.body.id as string };
  }

  /** A product made published directly in the database; `offset` orders `publishedAt`. */
  async function product(
    owner: { rep: { auth: string } },
    name: string,
    category: string,
    offset: number,
  ) {
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: owner.rep.auth,
      body: { name, category, priceVnd: 100_000, stock: 1 },
    });
    expect(created.status).toBe(201);
    await db.orm.em
      .fork()
      .nativeUpdate(
        Product,
        { id: created.body.id },
        { status: 'PUBLISHED', publishedAt: day(offset) },
      );
    return created.body.id as string;
  }

  async function scans(productId: string, count: number, createdAt: Date) {
    const em = db.orm.em.fork();
    for (let i = 0; i < count; i++) {
      em.create(TraceScan, { product: em.getReference(Product, productId), createdAt });
    }
    await em.flush();
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);

    const open = await approvedHousehold('Gốm Mở Cửa', 'gom-mo-cua');
    const closed = await approvedHousehold('Gốm Kín Cổng', 'gom-kin-cong');

    const em = db.orm.em.fork();
    for (const [household, fields] of [
      [open.id, { name: 'Phòng trưng bày', purpose: 'SHOWROOM', acceptsVisitors: true }],
      // Neither of these welcomes a visitor: a production site, and a showroom that is not open to visitors.
      [closed.id, { name: 'Lò nung', purpose: 'PRODUCTION', acceptsVisitors: true }],
      [closed.id, { name: 'Phòng chờ', purpose: 'SHOWROOM', acceptsVisitors: false }],
    ] as const) {
      em.create(Workshop, {
        household: em.getReference(Household, household),
        address: 'Xóm 1',
        ...fields,
      });
    }
    await em.flush();

    const openVase = await product(open, 'Bình mở cửa', 'VASE', 1);
    await product(open, 'Đĩa mở cửa', 'TABLEWARE', 2);
    await product(closed, 'Lư hương kín', 'WORSHIP', 3);
    const closedTea = await product(closed, 'Ấm trà kín', 'TEA', 4);

    // closedTea: 3 scans in the window; openVase: 1 inside it and 5 outside (45 days ago) that must not count.
    await scans(closedTea, 3, daysAgo(2));
    await scans(openVase, 1, daysAgo(10));
    await scans(openVase, 5, daysAgo(45));

    const newsEm = db.orm.em.fork();
    newsEm.create(News, {
      slug: 'lang-gom-vao-hoi',
      title: 'Làng gốm vào hội',
      summary: 'Tóm tắt',
      body: 'Nội dung',
      category: 'VILLAGE_EVENT',
      household: null,
      status: 'PUBLISHED',
      publishedAt: day(-5),
      pinned: false,
      visibility: 'PUBLIC',
    });
    await newsEm.flush();
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('openWorkshop=true lists only households with a workshop that welcomes visitors', async () => {
    const yes = await t.request({
      method: 'GET',
      url: '/products?openWorkshop=true&sort=price_asc',
    });
    expect(yes.status).toBe(200);
    expect(names(yes).sort()).toEqual(['Bình mở cửa', 'Đĩa mở cửa']);
    const no = await t.request({ method: 'GET', url: '/products?openWorkshop=false' });
    expect(names(no).sort()).toEqual(['Lư hương kín', 'Ấm trà kín']);
    const all = await t.request({ method: 'GET', url: '/products' });
    expect(names(all)).toHaveLength(4);
  });

  it('openWorkshop works in page mode and combines with another filter', async () => {
    const page = await t.request({
      method: 'GET',
      url: '/products?openWorkshop=true&page=1&limit=1',
    });
    expect(page.body).toMatchObject({ page: 1, total: 2, totalPages: 2 });
    const both = await t.request({
      method: 'GET',
      url: '/products?openWorkshop=true&category=VASE',
    });
    expect(names(both)).toEqual(['Bình mở cửa']);
  });

  it('sort=popular ranks by scans in the last 30 days, then newest', async () => {
    const res = await t.request({ method: 'GET', url: '/products?sort=popular' });
    expect(res.status).toBe(200);
    // 3 scans, then 1 (the 5 old ones do not count), then none: newest first.
    expect(names(res)).toEqual(['Ấm trà kín', 'Bình mở cửa', 'Lư hương kín', 'Đĩa mở cửa']);
  });

  it('sort=popular pages by cursor and by page number without repeats or gaps', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const qs: string = cursor ? `&cursor=${cursor}` : '';
      const res = await t.request({ method: 'GET', url: `/products?sort=popular&limit=1${qs}` });
      expect(res.status).toBe(200);
      seen.push(...names(res));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toEqual(['Ấm trà kín', 'Bình mở cửa', 'Lư hương kín', 'Đĩa mở cửa']);

    const page2 = await t.request({ method: 'GET', url: '/products?sort=popular&page=2&limit=2' });
    expect(names(page2)).toEqual(['Lư hương kín', 'Đĩa mở cửa']);
    const filtered = await t.request({
      method: 'GET',
      url: '/products?sort=popular&openWorkshop=true',
    });
    expect(names(filtered)).toEqual(['Bình mở cửa', 'Đĩa mở cửa']);
  });

  it('a malformed popular cursor is a validation error, not a 500', async () => {
    const forged = Buffer.from(JSON.stringify({ v: 1, id: 'x' })).toString('base64url');
    const res = await t.request({ method: 'GET', url: `/products?sort=popular&cursor=${forged}` });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('product search by category name finds the category (accents optional, either language)', async () => {
    const vi = await t.request({ method: 'GET', url: '/products?q=do%20tho' });
    expect(names(vi)).toEqual(['Lư hương kín']);
    const en = await t.request({ method: 'GET', url: '/products?q=altar' });
    expect(names(en)).toEqual(['Lư hương kín']);
    const text = await t.request({ method: 'GET', url: '/products?q=binh%20mo' });
    expect(names(text)).toEqual(['Bình mở cửa']);
  });

  it('suggestions include matching categories and news with their own slug', async () => {
    const cats = await t.request({ method: 'GET', url: '/search/suggest?q=Do%20tho' });
    expect(cats.status).toBe(200);
    expect(cats.body.categories).toEqual([{ category: 'WORSHIP' }]);
    expect(cats.body.products.map((p: { name: string }) => p.name)).toEqual(['Lư hương kín']);

    const none = await t.request({ method: 'GET', url: '/search/suggest?q=binh%20mo' });
    expect(none.body.categories).toEqual([]);

    const article = await t.request({ method: 'GET', url: '/search/suggest?q=lang%20gom' });
    expect(article.body.news).toEqual([{ title: 'Làng gốm vào hội', slug: 'lang-gom-vao-hoi' }]);
    expect((await t.request({ method: 'GET', url: '/search/suggest?q=%20' })).status).toBe(422);
  });

  it('suggestions carry a short shared-cache lifetime; the product list does not', async () => {
    const suggest = await t.request({ method: 'GET', url: '/search/suggest?q=gom' });
    expect(suggest.headers['cache-control']).toBe(
      'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
    );
    const list = await t.request({ method: 'GET', url: '/products' });
    expect(String(list.headers['cache-control'] ?? '')).not.toContain('s-maxage');
  });
});
