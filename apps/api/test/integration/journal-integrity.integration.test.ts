import { AppUser, JournalEntry } from '@vcraft/database';
import { verifyChain } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const SHA = 'a'.repeat(64);

/**
 * Issue #7 — Nhật ký sản xuất và toàn vẹn (vCRAFT-9hg.4), qua HTTP trên CSDL thật:
 * mốc có công đoạn / ngày khai / ghi chú / ảnh; mốc đính chính hiện cạnh mốc gốc; backend kiểm chuỗi
 * khi ghi và trả đủ dấu băm để trình duyệt tự kiểm lại.
 */
describe('Journal authoring and integrity', () => {
  let db: TestDatabase;
  let t: TestApp;
  let rep: { id: string; auth: string };
  let other: { auth: string };
  let productId: string;
  let productVersion: number;
  let traceCode: string;

  const journalUrl = () => `/me/household/products/${productId}/journal`;
  const append = (body: Record<string, unknown>, auth = rep.auth) =>
    t.request({ method: 'POST', url: journalUrl(), auth, body });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    const admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Minh Châu', slug: 'gom-minh-chau' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    const product = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Chén tống men rạn' },
    });
    productId = product.body.id;
    productVersion = product.body.version;
    traceCode = product.body.traceCode;
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: other.auth,
      body: { name: 'Hộ khác', slug: 'ho-khac' },
    });
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('ghi mốc với công đoạn, ngày khai, ghi chú và ảnh; dấu băm nối từ GENESIS', async () => {
    const res = await append({
      stage: 'clay',
      declaredDate: '2026-09-02',
      note: 'Lọc đất sông Hồng, ủ ba tuần.',
      images: [{ url: 'https://media.example/clay.webp', sha256: SHA }],
    });
    expect(res.status).toBe(201);
    expect(res.body.entries[0]).toMatchObject({
      seq: 0,
      stage: 'clay',
      declaredDate: '2026-09-02',
      prevHash: 'GENESIS',
      images: [{ sha256: SHA }],
    });
    expect(res.body.inProgress).toBe(true);
    expect(res.body.missingStages).toContain('finish');
  });

  it('bỏ qua công đoạn mà thiếu lý do bị từ chối; có lý do thì được', async () => {
    const missing = await append({
      stage: 'glaze',
      declaredDate: '2026-09-20',
      note: 'Tráng men.',
    });
    expect(missing.status).toBe(422);
    expect(missing.body.code).toBe('JOURNAL_SKIP_REASON_REQUIRED');

    await append({ stage: 'throw', declaredDate: '2026-09-05', note: 'Vuốt dáng.' });
    await append({ stage: 'dry', declaredDate: '2026-09-09', note: 'Phơi mộc.' });
    const ok = await append({
      stage: 'glaze',
      declaredDate: '2026-09-20',
      note: 'Tráng men rạn.',
      skipReason: 'Chén men rạn không vẽ lam',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.entries.at(-1).skipReason).toBe('Chén men rạn không vẽ lam');
  });

  it('trước khi xuất bản: sửa và xóa mốc trực tiếp, chuỗi được niêm phong lại', async () => {
    const journal = await t.request({ method: 'GET', url: journalUrl(), auth: rep.auth });
    const dry = journal.body.entries[2];
    const edited = await t.request({
      method: 'PATCH',
      url: `/journal-entries/${dry.id}`,
      auth: rep.auth,
      headers: { 'if-match': String(dry.version) },
      body: { stage: 'dry', declaredDate: '2026-09-10', note: 'Phơi mộc trong bóng râm.' },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.entries[2].note).toBe('Phơi mộc trong bóng râm.');
    expect(edited.body.entries[3].prevHash).toBe(edited.body.entries[2].hash);

    const extra = await append({ stage: 'dry', declaredDate: '2026-09-11', note: 'Thừa.' });
    const toDelete = extra.body.entries.at(-1);
    const removed = await t.request({
      method: 'DELETE',
      url: `/journal-entries/${toDelete.id}`,
      auth: rep.auth,
      headers: { 'if-match': String(toDelete.version) },
    });
    expect(removed.status).toBe(200);
    expect(removed.body.entries).toHaveLength(4);
    expect(await verifyChain(productId, toChain(removed.body.entries))).toEqual({
      ok: true,
      count: 4,
    });
  });

  it('hộ khác không đọc hay ghi được nhật ký này (404, không lộ sản phẩm tồn tại)', async () => {
    expect((await t.request({ method: 'GET', url: journalUrl(), auth: other.auth })).status).toBe(
      404,
    );
    const write = await append(
      { stage: 'fire', declaredDate: '2026-10-01', note: 'x' },
      other.auth,
    );
    expect(write.status).toBe(404);
  });

  it('sau xuất bản: không sửa trực tiếp; mốc đính chính nêu mốc bị thay và cả hai cùng hiện', async () => {
    const published = await t.request({
      method: 'POST',
      url: `/products/${productId}/publish`,
      auth: rep.auth,
      headers: { 'if-match': String(productVersion) },
    });
    expect(published.status).toBe(200);

    const journal = await t.request({ method: 'GET', url: journalUrl(), auth: rep.auth });
    const glaze = journal.body.entries[3];
    const edit = await t.request({
      method: 'PATCH',
      url: `/journal-entries/${glaze.id}`,
      auth: rep.auth,
      headers: { 'if-match': String(glaze.version) },
      body: { stage: 'glaze', declaredDate: '2026-09-21', note: 'Sửa lén.', skipReason: 'x' },
    });
    expect(edit.status).toBe(409);
    expect(edit.body.code).toBe('JOURNAL_PUBLISHED_IMMUTABLE');

    const correction = await append({
      stage: 'glaze',
      declaredDate: '2026-09-21',
      note: 'Đính chính: tráng men ngày 21, không phải 20.',
      supersedesEntryId: glaze.id,
    });
    expect(correction.status).toBe(201);
    const [original, fix] = [correction.body.entries[3], correction.body.entries[4]];
    expect(original).toMatchObject({ seq: 3, note: 'Tráng men rạn.', supersededBySeq: 4 });
    expect(fix).toMatchObject({ seq: 4, supersedesSeq: 3, supersededBySeq: null });

    const twice = await append({
      stage: 'glaze',
      declaredDate: '2026-09-22',
      note: 'Lần nữa.',
      supersedesEntryId: glaze.id,
    });
    expect(twice.body.code).toBe('JOURNAL_CORRECTION_TARGET_SUPERSEDED');
  });

  it('trang QR trả nhật ký kèm dấu băm; trình duyệt tự kiểm lại được', async () => {
    const trace = await t.request({ method: 'GET', url: `/trace/${traceCode}` });
    expect(trace.status).toBe(200);
    const { journal } = trace.body;
    expect(journal.productId).toBe(productId);
    expect(journal.entries).toHaveLength(5);
    expect(await verifyChain(journal.productId, toChain(journal.entries))).toEqual({
      ok: true,
      count: 5,
    });
  });

  it('chuỗi bị sửa thẳng trong CSDL: backend phát hiện và từ chối ghi thêm', async () => {
    const em = db.orm.em.fork();
    const entry = await em.findOneOrFail(JournalEntry, { product: productId, seq: 1 });
    entry.note = 'Bị sửa ngoài ứng dụng';
    await em.flush();

    const res = await append({ stage: 'glaze', declaredDate: '2026-10-01', note: 'Tráng lại.' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('JOURNAL_INTEGRITY_BROKEN');
    expect(res.body.detail).toContain('entry 2');
  });

  it('khóa tài khoản đại diện đóng băng nhật ký', async () => {
    const em = db.orm.em.fork();
    const user = await em.findOneOrFail(AppUser, rep.id);
    user.status = 'LOCKED';
    await em.flush();
    const res = await append({ stage: 'fire', declaredDate: '2026-10-01', note: 'Nung lò.' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('HOUSEHOLD_ACCOUNT_LOCKED');
  });
});

function toChain(
  entries: {
    seq: number;
    stage: string;
    declaredDate: string;
    note: string;
    images: { sha256: string }[];
    supersedesSeq: number | null;
    skipReason: string | null;
    prevHash: string;
    hash: string;
  }[],
) {
  return entries.map((e) => ({
    seq: e.seq,
    stage: e.stage,
    at: e.declaredDate,
    note: e.note,
    mediaChecksums: e.images.map((i) => i.sha256),
    supersedesSeq: e.supersedesSeq ?? undefined,
    skipReason: e.skipReason ?? undefined,
    prevHash: e.prevHash,
    hash: e.hash,
  }));
}
