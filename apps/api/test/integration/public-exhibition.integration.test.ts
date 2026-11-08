import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMilestone, createJournalPhoto } from './support/journal-photo.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #8 — Triển lãm công khai và truy xuất QR (vCRAFT-9hg.6), qua HTTP trên CSDL thật:
 * ghi công từng người làm (người đăng là ban điều hành hộ), tách phòng trưng bày khỏi xưởng sản
 * xuất, ghim bản đồ chỉ của hộ đã duyệt để trang hiện kèm danh sách chữ.
 */
describe('Public exhibition and QR trace', () => {
  let db: TestDatabase;
  let t: TestApp;
  let rep: { id: string; auth: string };
  let productId: string;
  let traceCode: string;
  const artisans: Record<string, string> = {};

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
      body: { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', history: 'Năm đời làm gốm.' },
    });
    for (const [name, craftRole] of <[string, string][]>[
      ['Nguyễn Văn Bình', 'Thợ vuốt'],
      ['Trần Thị Lan', 'Thợ vẽ'],
    ]) {
      const res = await t.request({
        method: 'POST',
        url: '/me/household/artisans',
        auth: rep.auth,
        body: { name, craftRole },
      });
      artisans[name] = res.body.id;
    }
    for (const body of [
      {
        name: 'Phòng trưng bày Minh Hải',
        address: 'Số 12 đường Gốm, Bát Tràng',
        purpose: 'SHOWROOM',
        acceptsVisitors: true,
        visitingInfo: 'Mở cửa 8:00–17:00, không cần hẹn.',
        openingHours: [{ day: 1, open: '08:00', close: '17:00' }],
        lat: 20.9752,
        lng: 105.9131,
      },
      {
        name: 'Lò nung Minh Hải',
        address: 'Xóm 5, Bát Tràng',
        purpose: 'PRODUCTION',
        acceptsVisitors: true,
        lat: 20.9771,
        lng: 105.9155,
      },
      { name: 'Kho mộc', address: 'Xóm 5, Bát Tràng', purpose: 'PRODUCTION' },
    ]) {
      await t.request({ method: 'POST', url: '/me/household/workshops', auth: rep.auth, body });
    }
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    // Only an approved household posts products (GH#237).
    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình hút lộc men lam' },
    });
    productId = product.body.id;
    traceCode = product.body.traceCode;

    // Hộ chưa duyệt: không được hiện trên bản đồ
    const pending = await t.createUser('BUYER');
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: pending.auth,
      body: { name: 'Hộ chờ duyệt', slug: 'ho-cho-duyet' },
    });
    await t.request({
      method: 'POST',
      url: '/me/household/workshops',
      auth: pending.auth,
      body: {
        name: 'Xưởng chờ',
        address: 'Xóm 1, Bát Tràng',
        purpose: 'BOTH',
        acceptsVisitors: true,
        lat: 20.97,
        lng: 105.91,
      },
    });
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('ghi công từng người làm theo phần việc; người đăng là ban điều hành hộ', async () => {
    const res = await t.request({
      method: 'PUT',
      url: `/me/household/products/${productId}/makers`,
      auth: rep.auth,
      body: {
        makers: [
          { artisanId: artisans['Nguyễn Văn Bình'], contribution: 'Vuốt dáng' },
          { artisanId: artisans['Trần Thị Lan'], contribution: 'Vẽ lam' },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.makers).toEqual([
      expect.objectContaining({ name: 'Nguyễn Văn Bình', contribution: 'Vuốt dáng' }),
      expect.objectContaining({ name: 'Trần Thị Lan', contribution: 'Vẽ lam' }),
    ]);
    expect(res.body.postedBy).toBe('HOUSEHOLD_ADMINISTRATION');
  });

  it('không ghi công người ngoài hộ hoặc ghi trùng', async () => {
    const outsider = await t.request({
      method: 'PUT',
      url: `/me/household/products/${productId}/makers`,
      auth: rep.auth,
      body: { makers: [{ artisanId: crypto.randomUUID(), contribution: 'Nung' }] },
    });
    expect(outsider.status).toBe(422);
    expect(outsider.body.code).toBe('MAKER_NOT_IN_HOUSEHOLD');

    const twice = await t.request({
      method: 'PUT',
      url: `/me/household/products/${productId}/makers`,
      auth: rep.auth,
      body: {
        makers: [
          { artisanId: artisans['Trần Thị Lan'], contribution: 'Vẽ lam' },
          { artisanId: artisans['Trần Thị Lan'], contribution: 'Tráng men' },
        ],
      },
    });
    expect(twice.body.code).toBe('MAKER_DUPLICATED');
  });

  it('hồ sơ công khai tách phòng trưng bày đón khách khỏi xưởng sản xuất', async () => {
    await addMilestone(t, rep, productId, await createJournalPhoto(db, t, rep));
    await t.request({
      method: 'POST',
      url: `/products/${productId}/publish`,
      auth: rep.auth,
      headers: { 'if-match': '1' },
    });
    const res = await t.request({ method: 'GET', url: '/households/gom-minh-hai' });
    expect(res.status).toBe(200);
    expect(res.body.visit.showrooms.map((w: { name: string }) => w.name)).toEqual([
      'Phòng trưng bày Minh Hải',
    ]);
    // Lò nung lỡ bật "nhận khách" vẫn là nơi sản xuất, không phải điểm thăm
    expect(res.body.visit.productionWorkshops.map((w: { name: string }) => w.name)).toEqual([
      'Lò nung Minh Hải',
      'Kho mộc',
    ]);
    expect(res.body.products[0].makers.map((m: { name: string }) => m.name)).toEqual([
      'Nguyễn Văn Bình',
      'Trần Thị Lan',
    ]);
  });

  it('trang QR mang ghi công người làm', async () => {
    const res = await t.request({ method: 'GET', url: `/trace/${traceCode}` });
    expect(res.body.availability).toBe('VISIBLE');
    expect(res.body.product.makers).toHaveLength(2);
    expect(res.body.product.postedBy).toBe('HOUSEHOLD_ADMINISTRATION');
  });

  it('bản đồ chỉ có xưởng có tọa độ của hộ đã duyệt, đánh dấu nơi thăm được', async () => {
    const res = await t.request({ method: 'GET', url: '/map/workshops' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([
      expect.objectContaining({
        workshopName: 'Lò nung Minh Hải',
        visitable: false,
        visitingInfo: null,
        household: { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', craft: null, coverUrl: null },
      }),
      expect.objectContaining({
        workshopName: 'Phòng trưng bày Minh Hải',
        visitable: true,
        visitingInfo: 'Mở cửa 8:00–17:00, không cần hẹn.',
        openingHours: [{ day: 1, open: '08:00', close: '17:00' }],
        lat: 20.9752,
        lng: 105.9131,
      }),
    ]);
  });
});
