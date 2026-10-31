import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #28 — Danh mục công khai đọc từ API (FR-CAT): lọc, sắp xếp, phân trang con trỏ và tìm không
 * dấu, chạy qua HTTP trên CSDL thật; chỉ sản phẩm đã xuất bản của hộ đã duyệt mới hiện.
 */
describe('Public catalog', () => {
  let db: TestDatabase;
  let t: TestApp;
  let adminAuth: string;
  let rep: { auth: string };
  let householdId: string;
  let householdVersion: number;

  const names = (res: { body: { data: { name: string }[] } }) => res.body.data.map((p) => p.name);

  async function publish(
    name: string,
    fields: {
      priceVnd: number;
      stock: number;
      category: string;
      kind?: string;
      batchSize?: number;
    },
  ) {
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name, ...fields },
    });
    expect(created.status).toBe(201);
    const res = await t.request({
      method: 'POST',
      url: `/products/${created.body.id}/publish`,
      auth: rep.auth,
      headers: { 'if-match': `"${created.body.version}"` },
    });
    expect(res.status).toBe(200);
    return created.body as { id: string; slug: string; traceCode: string };
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    adminAuth = (await t.createUser('ADMIN')).auth;
    rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Bát Tràng Xưa', slug: 'gom-bat-trang-xua', history: 'Năm đời.' },
    });
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: adminAuth,
      headers: { 'if-match': `"${applied.body.version}"` },
      body: {},
    });
    householdId = applied.body.id;
    householdVersion = approved.body.version;

    await publish('Bình hút lộc men lam', { priceVnd: 900_000, stock: 1, category: 'VASE' });
    await publish('Bát ăn cơm', {
      priceVnd: 100_000,
      stock: 40,
      category: 'TABLEWARE',
      kind: 'BATCH',
      batchSize: 40,
    });
    await publish('Tách trà men ngọc', { priceVnd: 300_000, stock: 0, category: 'TEA' });
    await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bản nháp không hiện', priceVnd: 1, stock: 1, category: 'VASE' },
    });
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('chỉ liệt kê sản phẩm đã xuất bản, kèm tên hộ', async () => {
    const res = await t.request({ method: 'GET', url: '/products?sort=price_asc' });
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['Bát ăn cơm', 'Tách trà men ngọc', 'Bình hút lộc men lam']);
    expect(res.body.data[0].household).toEqual({
      name: 'Gốm Bát Tràng Xưa',
      slug: 'gom-bat-trang-xua',
    });
  });

  it('lọc theo danh mục, hộ, khoảng giá, độc bản, còn hàng', async () => {
    const get = (qs: string) => t.request({ method: 'GET', url: `/products?${qs}&sort=price_asc` });
    expect(names(await get('category=TEA'))).toEqual(['Tách trà men ngọc']);
    expect(names(await get('household=khong-co'))).toEqual([]);
    expect(names(await get('household=gom-bat-trang-xua'))).toHaveLength(3);
    expect(names(await get('minPrice=200000&maxPrice=500000'))).toEqual(['Tách trà men ngọc']);
    expect(names(await get('oneOfAKind=true'))).toEqual([
      'Tách trà men ngọc',
      'Bình hút lộc men lam',
    ]);
    expect(names(await get('oneOfAKind=false'))).toEqual(['Bát ăn cơm']);
    expect(names(await get('inStock=true'))).toEqual(['Bát ăn cơm', 'Bình hút lộc men lam']);
  });

  it('phân trang con trỏ đi hết danh sách, không lặp, ở mọi kiểu sắp xếp', async () => {
    for (const [sort, expected] of [
      ['price_desc', ['Bình hút lộc men lam', 'Tách trà men ngọc', 'Bát ăn cơm']],
      ['price_asc', ['Bát ăn cơm', 'Tách trà men ngọc', 'Bình hút lộc men lam']],
    ] as const) {
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const qs: string = cursor ? `&cursor=${cursor}` : '';
        const res = await t.request({ method: 'GET', url: `/products?limit=2&sort=${sort}${qs}` });
        expect(res.status).toBe(200);
        seen.push(...names(res));
        cursor = res.body.nextCursor;
      } while (cursor);
      expect(seen).toEqual(expected);
    }
    const newest = new Set<string>();
    let cursor: string | null = null;
    do {
      const qs: string = cursor ? `&cursor=${cursor}` : '';
      const res = await t.request({ method: 'GET', url: `/products?limit=1${qs}` });
      for (const name of names(res)) newest.add(name);
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(newest.size).toBe(3);
  });

  it('con trỏ hỏng trả lỗi kiểm dữ liệu, không phải 500', async () => {
    const res = await t.request({ method: 'GET', url: '/products?cursor=rac' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('tìm không dấu: "bat trang" khớp "Bát Tràng" trên sản phẩm, hộ và tin', async () => {
    const list = await t.request({ method: 'GET', url: '/products?q=men%20NGOC' });
    expect(names(list)).toEqual(['Tách trà men ngọc']);
    const res = await t.request({ method: 'GET', url: '/search/suggest?q=bat%20trang' });
    expect(res.status).toBe(200);
    expect(res.body.households).toEqual([{ name: 'Gốm Bát Tràng Xưa', slug: 'gom-bat-trang-xua' }]);
    const product = await t.request({ method: 'GET', url: '/search/suggest?q=binh%20hut' });
    expect(product.body.products[0]).toMatchObject({
      name: 'Bình hút lộc men lam',
      household: 'Gốm Bát Tràng Xưa',
    });
  });

  it('danh sách hộ và số liệu làng chỉ đếm hộ đã duyệt', async () => {
    const list = await t.request({ method: 'GET', url: '/households' });
    expect(list.body.data).toEqual([
      expect.objectContaining({ slug: 'gom-bat-trang-xua', productCount: 3 }),
    ]);
    const stats = await t.request({ method: 'GET', url: '/village/stats' });
    expect(stats.body).toEqual({ households: 1, products: 3, artisans: 0 });
  });

  it('chi tiết sản phẩm theo slug; nháp là 404; hộ bị khóa thì biến khỏi danh mục', async () => {
    const list = await t.request({ method: 'GET', url: '/products?category=VASE' });
    const detail = await t.request({ method: 'GET', url: `/products/${list.body.data[0].slug}` });
    expect(detail.status).toBe(200);
    expect(detail.body.product.priceVnd).toBe(900_000);
    expect(detail.body.household.slug).toBe('gom-bat-trang-xua');
    expect(detail.body.journal.entries).toEqual([]);
    expect((await t.request({ method: 'GET', url: '/products/khong-co' })).status).toBe(404);

    const suspended = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/suspend`,
      auth: adminAuth,
      headers: { 'if-match': `"${householdVersion}"` },
      body: { reason: 'Kiểm tra hàng nhái' },
    });
    expect(suspended.status).toBe(200);
    expect(names(await t.request({ method: 'GET', url: '/products' }))).toEqual([]);
    expect(
      (await t.request({ method: 'GET', url: `/products/${list.body.data[0].slug}` })).status,
    ).toBe(404);

    const trace = await t.request({
      method: 'GET',
      url: `/trace/${list.body.data[0].traceCode}`,
    });
    expect(trace.body).toEqual({
      availability: 'UNAVAILABLE',
      traceCode: list.body.data[0].traceCode,
      reason: 'HOUSEHOLD_SUSPENDED',
    });
  });
});
