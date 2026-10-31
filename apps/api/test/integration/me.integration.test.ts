import { AppUser } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** FR-AUTH-09: `GET /me` trả vai trò và trạng thái từ CSDL vCraft cho guard của web. */
describe('GET /me', () => {
  let db: TestDatabase;
  let t: TestApp;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('không có token thì 401', async () => {
    const res = await t.request({ method: 'GET', url: '/me' });
    expect(res.status).toBe(401);
  });

  it('người mua: vai trò BUYER, ACTIVE, chưa có hồ sơ hộ', async () => {
    const buyer = await t.createUser('BUYER');
    const res = await t.request({ method: 'GET', url: '/me', auth: buyer.auth });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: buyer.id,
      role: 'BUYER',
      status: 'ACTIVE',
      emailVerified: true,
      household: null,
    });
  });

  it('nộp hồ sơ hộ thì thành HOUSEHOLD kèm trạng thái PENDING_REVIEW', async () => {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Thanh Hà', slug: 'gom-thanh-ha', history: '' },
    });
    expect(applied.status).toBe(201);

    const res = await t.request({ method: 'GET', url: '/me', auth: rep.auth });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('HOUSEHOLD');
    expect(res.body.household).toMatchObject({
      name: 'Gốm Thanh Hà',
      slug: 'gom-thanh-ha',
      status: 'PENDING_REVIEW',
      statusReason: null,
    });
  });

  it('tài khoản bị khóa vẫn đọc được /me để giao diện giải thích lý do', async () => {
    const user = await t.createUser('HOUSEHOLD');
    const em = db.orm.em.fork();
    (await em.findOneOrFail(AppUser, user.id)).status = 'LOCKED';
    await em.flush();

    const res = await t.request({ method: 'GET', url: '/me', auth: user.auth });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('LOCKED');
  });
});
