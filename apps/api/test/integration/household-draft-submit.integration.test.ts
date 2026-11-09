import { Household, MediaAsset, Workshop } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** An application is a draft until the final wizard step; the queue and approval need a complete one. */
describe('Household draft until submit', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let rep: { id: string; auth: string };
  let household: { id: string; version: number };

  const queueIds = async () =>
    (await t.request({ method: 'GET', url: '/admin/households', auth: admin.auth })).body.data.map(
      (row: { id: string }) => row.id,
    );
  const submit = () => t.request({ method: 'POST', url: '/me/household/submit', auth: rep.auth });
  const approve = (version: number) =>
    t.request({
      method: 'POST',
      url: `/admin/households/${household.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body: {},
      strict: true,
    });

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
      body: { name: 'Gốm Nháp', slug: 'gom-nhap', history: 'Khai báo.' },
    });
    household = applied.body;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('creates the application as a draft that the board cannot see', async () => {
    expect(household).toMatchObject({ status: 'DRAFT' });
    expect(await queueIds()).not.toContain(household.id);
    const filtered = await t.request({
      method: 'GET',
      url: '/admin/households?status=DRAFT',
      auth: admin.auth,
    });
    expect(filtered.body.data).toEqual([]);
    expect(
      (
        await t.request({
          method: 'GET',
          url: `/admin/households/${household.id}`,
          auth: admin.auth,
        })
      ).status,
    ).toBe(404);
  });

  it('refuses to submit while a workshop and a document are missing', async () => {
    const res = await submit();
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('APPLICATION_INCOMPLETE');
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual([
      'workshops',
      'documents',
    ]);
  });

  it('lists the representative own documents and submits once complete', async () => {
    expect(
      (await t.request({ method: 'GET', url: '/me/household/documents', auth: rep.auth })).body
        .data,
    ).toEqual([]);
    const em = db.orm.em.fork();
    const draft = await em.findOneOrFail(Household, household.id);
    em.create(Workshop, {
      household: draft,
      name: 'Xưởng',
      address: 'Bát Tràng, Gia Lâm',
    });
    em.create(MediaAsset, {
      ownerId: rep.id,
      purpose: 'CERTIFICATE',
      visibility: 'PRIVATE',
      status: 'READY',
      mimeType: 'application/pdf',
      sizeBytes: 3,
      sha256: 'd'.repeat(64),
      originalKey: `originals/${rep.id}/doc`,
    });
    await em.flush();
    const docs = await t.request({ method: 'GET', url: '/me/household/documents', auth: rep.auth });
    expect(docs.body.data).toHaveLength(1);

    const res = await submit();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING_REVIEW');
    expect(await queueIds()).toContain(household.id);
    // A second submit is not a valid transition.
    expect((await submit()).status).toBe(409);
    household = res.body;
  });

  it('approves a complete submitted application', async () => {
    const res = await approve(household.version);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
  });

  it('rejects approval of an incomplete pending application', async () => {
    const other = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: other.auth,
      body: { name: 'Gốm Thiếu', slug: 'gom-thieu', history: '' },
    });
    // Legacy rows may be pending without parts: force the status directly.
    await db.orm.em
      .getConnection()
      .execute(`update household set status = 'PENDING_REVIEW' where id = '${applied.body.id}'`);
    const res = await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
      body: {},
      strict: true,
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('APPLICATION_INCOMPLETE');
  });
});
