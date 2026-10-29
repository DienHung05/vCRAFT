import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #6 — Duyệt hộ và xuất bản (vCRAFT-9hg.3), chạy qua HTTP trên CSDL thật:
 * - hộ được duyệt thì có hồ sơ công khai kèm xưởng và sản phẩm;
 * - tạm ngừng ẩn phần công khai nhưng hộ vẫn đọc đủ bản ghi riêng;
 * - rút sản phẩm ẩn sản phẩm (và nhật ký), QR chỉ còn thông báo "không còn trưng bày".
 */
describe('Household approval and publishing', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let rep: { auth: string };
  let householdId: string;
  let householdVersion: number;
  let productId: string;
  let traceCode: string;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('người đại diện nộp hồ sơ, thêm xưởng, nghệ nhân và sản phẩm nháp', async () => {
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Đông Hải', slug: 'gom-dong-hai', history: 'Ba đời làm gốm men lam.' },
    });
    expect(applied.status).toBe(201);
    expect(applied.body.status).toBe('PENDING_REVIEW');
    householdId = applied.body.id;
    householdVersion = applied.body.version;

    const workshop = await t.request({
      method: 'POST',
      url: '/me/household/workshops',
      auth: rep.auth,
      body: {
        name: 'Lò Đông Hải',
        address: 'Xóm 3, Bát Tràng, Gia Lâm',
        purpose: 'BOTH',
        lat: 20.9758,
        lng: 105.9139,
      },
    });
    expect(workshop.status).toBe(201);
    expect(workshop.body).toMatchObject({ purpose: 'BOTH', lat: 20.9758, lng: 105.9139 });

    expect(
      (
        await t.request({
          method: 'POST',
          url: '/me/household/artisans',
          auth: rep.auth,
          body: { name: 'Nguyễn Văn Hải' },
        })
      ).status,
    ).toBe(201);

    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình men lam vẽ sen', description: 'Bình cao 40cm' },
    });
    expect(product.status).toBe(201);
    expect(product.body).toMatchObject({ status: 'DRAFT', kind: 'OBJECT' });
    expect(product.body.traceCode).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(product.body.slug).toBe(`binh-men-lam-ve-sen-${product.body.traceCode.toLowerCase()}`);
    productId = product.body.id;
    traceCode = product.body.traceCode;
  });

  it('hộ chưa duyệt: không xuất bản được, không có gì công khai', async () => {
    const publish = await t.request({
      method: 'POST',
      url: `/products/${productId}/publish`,
      auth: rep.auth,
      headers: { 'if-match': '1' },
    });
    expect(publish.status).toBe(409);
    expect(publish.body.code).toBe('HOUSEHOLD_NOT_APPROVED');
    expect((await t.request({ method: 'GET', url: '/households/gom-dong-hai' })).status).toBe(404);
  });

  it('chỉ Ban quản lý duyệt được; thiếu If-Match bị chặn; phiên bản cũ bị từ chối', async () => {
    const byRep = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: rep.auth,
      headers: { 'if-match': String(householdVersion) },
    });
    expect(byRep.status).toBe(403);

    const noVersion = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
    });
    expect(noVersion.status).toBe(428);
    expect(noVersion.body.code).toBe('VERSION_REQUIRED');

    const stale = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(householdVersion + 5) },
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('STALE_VERSION');

    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(householdVersion) },
    });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    householdVersion = approved.body.version;
  });

  it('hộ đã duyệt xuất bản sản phẩm ⇒ hồ sơ công khai có xưởng và sản phẩm, QR hiện đầy đủ', async () => {
    const published = await t.request({
      method: 'POST',
      url: `/products/${productId}/publish`,
      auth: rep.auth,
      headers: { 'if-match': '1' },
    });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('PUBLISHED');

    const profile = await t.request({ method: 'GET', url: '/households/gom-dong-hai' });
    expect(profile.status).toBe(200);
    expect(profile.body.workshops).toHaveLength(1);
    expect(profile.body.artisans[0].name).toBe('Nguyễn Văn Hải');
    expect(profile.body.products.map((p: { id: string }) => p.id)).toEqual([productId]);
    expect(profile.body).not.toHaveProperty('statusReason');

    const trace = await t.request({ method: 'GET', url: `/trace/${traceCode.toLowerCase()}` });
    expect(trace.status).toBe(200);
    expect(trace.body).toMatchObject({
      availability: 'VISIBLE',
      household: { slug: 'gom-dong-hai' },
    });
  });

  it('tạm ngừng: ẩn công khai, QR chỉ còn thông báo, hộ vẫn đọc đủ bản ghi riêng', async () => {
    const noReason = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/suspend`,
      auth: admin.auth,
      headers: { 'if-match': String(householdVersion) },
    });
    expect(noReason.status).toBe(422);

    const suspended = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/suspend`,
      auth: admin.auth,
      headers: { 'if-match': String(householdVersion) },
      body: { reason: 'Đang xác minh lại giấy tờ' },
    });
    expect(suspended.status).toBe(200);
    expect(suspended.body.status).toBe('SUSPENDED');
    householdVersion = suspended.body.version;

    expect((await t.request({ method: 'GET', url: '/households/gom-dong-hai' })).status).toBe(404);
    const trace = await t.request({ method: 'GET', url: `/trace/${traceCode}` });
    expect(trace.status).toBe(200);
    expect(trace.body).toEqual({ availability: 'UNAVAILABLE', traceCode });

    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({
      status: 'SUSPENDED',
      statusReason: 'Đang xác minh lại giấy tờ',
    });
    expect(mine.body.products).toHaveLength(1);
    expect(mine.body.workshops).toHaveLength(1);

    const reinstated = await t.request({
      method: 'POST',
      url: `/admin/households/${householdId}/reinstate`,
      auth: admin.auth,
      headers: { 'if-match': String(householdVersion) },
    });
    expect(reinstated.body.status).toBe('APPROVED');
    expect((await t.request({ method: 'GET', url: '/households/gom-dong-hai' })).status).toBe(200);
  });

  it('rút sản phẩm: biến khỏi hồ sơ công khai, QR hiện thông báo không còn trưng bày', async () => {
    const withdrawn = await t.request({
      method: 'POST',
      url: `/products/${productId}/withdraw`,
      auth: rep.auth,
      headers: { 'if-match': '2' },
      body: { reason: 'Sản phẩm bị nứt khi nung' },
    });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.status).toBe('WITHDRAWN');

    const profile = await t.request({ method: 'GET', url: '/households/gom-dong-hai' });
    expect(profile.body.products).toEqual([]);
    const trace = await t.request({ method: 'GET', url: `/trace/${traceCode}` });
    expect(trace.body).toEqual({ availability: 'UNAVAILABLE', traceCode });

    const mine = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    expect(mine.body.products[0].status).toBe('WITHDRAWN');
  });

  it('mã sai trả 404 Problem Details; chưa đăng nhập không vào được khu riêng', async () => {
    const missing = await t.request({ method: 'GET', url: '/trace/ZZZZZZZZ' });
    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ code: 'NOT_FOUND', type: '/problems/not-found' });
    expect((await t.request({ method: 'GET', url: '/me/household' })).status).toBe(401);
    expect(
      (await t.request({ method: 'GET', url: '/admin/households', auth: rep.auth })).status,
    ).toBe(403);
    const list = await t.request({
      method: 'GET',
      url: '/admin/households?status=APPROVED',
      auth: admin.auth,
    });
    expect(list.body.map((h: { id: string }) => h.id)).toContain(householdId);
  });
});
