import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * Issue #31 — Hồ sơ hộ trong Studio (FR-ART-01 … 07): chỉ chủ hộ sửa được, mọi thay đổi hiện trên
 * trang công khai, dấu "đã xác minh" không tự khai được, độ hoàn thiện tăng theo nội dung.
 */
describe('Studio household profile', () => {
  let db: TestDatabase;
  let t: TestApp;
  let owner: { auth: string };
  let other: { auth: string };
  let version: number;

  const patch = (body: object, v = version, auth = owner.auth) =>
    t.request({
      method: 'PATCH',
      url: '/me/household',
      auth,
      headers: { 'if-match': `"${v}"` },
      body,
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    const admin = await t.createUser('ADMIN');
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: owner.auth,
      body: { name: 'Gốm Hồ Sơ', slug: 'gom-ho-so', history: 'Ngắn.' },
    });
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
      body: {},
    });
    version = approved.body.version;
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: other.auth,
      body: { name: 'Gốm Khác', slug: 'gom-khac', history: '' },
    });
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('chủ hộ sửa câu chuyện, số đời, dòng thời gian, năng lực; trang công khai hiện ngay', async () => {
    const res = await patch({
      history:
        'Năm đời làm gốm bên bến sông, giữ men lam và cách vuốt tay từ thời ông cố để lại cho con cháu.',
      craft: 'men lam',
      foundedYear: 1962,
      generations: 5,
      timeline: [
        { year: 1985, title: 'Xây lò', text: 'Lò hộp đầu tiên.' },
        { year: 1962, title: 'Đỏ lửa', text: '' },
      ],
      capacityByCategory: { VASE: 200 },
    });
    expect(res.status).toBe(200);
    version = res.body.version;
    expect(res.body.timeline.map((e: { year: number }) => e.year)).toEqual([1962, 1985]);
    expect(res.body.completeness.percent).toBe(50);
    expect(res.body.completeness.missing).toEqual([
      'certifications',
      'gallery',
      'workshopLocation',
      'openingHours',
    ]);

    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body).toMatchObject({
      foundedYear: 1962,
      generations: 5,
      craft: 'men lam',
      capacityByCategory: { VASE: 200 },
    });
    expect(pub.body.status).toBeUndefined();
    expect(pub.body.completeness).toBeUndefined();
  });

  it('phiên bản cũ bị từ chối; thiếu If-Match cũng không ghi được', async () => {
    expect((await patch({ craft: 'x' }, version - 1)).status).toBe(409);
    const missing = await t.request({
      method: 'PATCH',
      url: '/me/household',
      auth: owner.auth,
      body: { craft: 'x' },
    });
    expect(missing.status).toBe(428);
  });

  it('khách không vào được; hộ khác chỉ sửa được hồ sơ của chính họ', async () => {
    const guest = await t.request({
      method: 'PATCH',
      url: '/me/household',
      headers: { 'if-match': '"1"' },
      body: {},
    });
    expect(guest.status).toBe(401);
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: other.auth });
    const res = await patch({ craft: 'men ngọc' }, mine.body.version, other.auth);
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('gom-khac');
    const owners = await t.request({ method: 'GET', url: '/me/household', auth: owner.auth });
    expect(owners.body.craft).toBe('men lam');
  });

  it('không tự khai "đã xác minh" được; dữ liệu nhập sai trả lỗi kiểm dữ liệu', async () => {
    const res = await patch({
      certifications: [{ name: 'OCOP 4 sao', issuer: 'UBND', year: 2023, verified: true }],
    });
    expect(res.status).toBe(200);
    version = res.body.version;
    expect(res.body.certifications[0].verified).toBe(false);
    expect((await patch({ timeline: [{ year: 5, title: 'x', text: '' }] })).status).toBe(422);
  });

  it('thư viện ảnh bắt buộc mô tả; không gắn được ảnh của người khác', async () => {
    const noAlt = await patch({
      gallery: [{ url: '/images/demo/bia-duc-phat-1280.webp', alt: '' }],
    });
    expect(noAlt.status).toBe(422);
    const foreign = await patch({
      gallery: [{ mediaId: '00000000-0000-4000-8000-000000000099', alt: 'Ảnh xưởng' }],
    });
    expect(foreign.status).toBe(403);
    const externalUrl = await patch({
      gallery: [{ url: 'https://evil.example/x.webp', alt: 'Ảnh xưởng' }],
    });
    expect(externalUrl.status).toBe(422);
    const res = await patch({
      gallery: [{ url: '/images/demo/bia-duc-phat-1280.webp', alt: 'Xưởng với giàn khay gốm' }],
    });
    expect(res.status).toBe(200);
    version = res.body.version;
    expect(res.body.gallery[0].url).toBe('/images/demo/bia-duc-phat-1280.webp');
    expect(res.body.coverUrl).toBe('/images/demo/bia-duc-phat-1280.webp');
  });

  it('xưởng: thêm rồi sửa địa chỉ, tọa độ, giờ mở cửa; chỉ chủ hộ; đầy đủ thì 100%', async () => {
    const created = await t.request({
      method: 'POST',
      url: '/me/household/workshops',
      auth: owner.auth,
      body: { name: 'Xưởng chính', address: 'Xóm 3, Bát Tràng' },
    });
    const url = `/me/household/workshops/${created.body.id}`;
    const body = {
      name: 'Xưởng chính',
      address: 'Số 12 đường Gốm, Bát Tràng',
      purpose: 'BOTH',
      acceptsVisitors: true,
      openingHours: [{ day: 1, open: '08:00', close: '17:00' }],
      lat: 20.9752,
      lng: 105.9131,
    };
    const stranger = await t.request({
      method: 'PUT',
      url,
      auth: other.auth,
      headers: { 'if-match': `"${created.body.version}"` },
      body,
    });
    expect(stranger.status).toBe(404);
    const updated = await t.request({
      method: 'PUT',
      url,
      auth: owner.auth,
      headers: { 'if-match': `"${created.body.version}"` },
      body,
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ lat: 20.9752, acceptsVisitors: true });
    const badHours = await t.request({
      method: 'PUT',
      url,
      auth: owner.auth,
      headers: { 'if-match': `"${updated.body.version}"` },
      body: { ...body, openingHours: [{ day: 1, open: '17:00', close: '08:00' }] },
    });
    expect(badHours.status).toBe(422);

    const mine = await t.request({ method: 'GET', url: '/me/household', auth: owner.auth });
    expect(mine.body.completeness).toEqual({ percent: 100, missing: [] });
    const pub = await t.request({ method: 'GET', url: '/households/gom-ho-so' });
    expect(pub.body.workshops[0].address).toBe('Số 12 đường Gốm, Bát Tràng');
  });
});
