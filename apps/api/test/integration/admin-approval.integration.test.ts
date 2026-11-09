import { AuditLog, Household, OutboxEvent, Product, TraceScan } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMilestone, createJournalPhoto } from './support/journal-photo.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

/**
 * Issue #35 — Tổng quan Ban quản lý và duyệt hộ (FR-ADM-01 … 04, 06, FR-MEDIA-04): số liệu, hàng đợi
 * có lọc, giấy tờ qua URL ký chỉ Admin đọc được, các quyết định ghi audit và xếp email.
 * vCRAFT-8my.4: the QR trend aggregates persisted `trace_scan` rows per Vietnam calendar date over a
 * bounded window, zero-filled — never invented history.
 */
describe('Admin dashboard and household approval', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let rep: { id: string; auth: string };
  let buyer: { auth: string };
  let household: { id: string; version: number };
  let documentId: string;

  const decide = (action: string, version: number, body: object = {}) =>
    t.request({
      method: 'POST',
      url: `/admin/households/${household.id}/${action}`,
      auth: admin.auth,
      headers: { 'if-match': `"${version}"` },
      body,
    });
  const dashboard = async () =>
    (await t.request({ method: 'GET', url: '/admin/dashboard', auth: admin.auth })).body;

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    rep = await t.createUser('BUYER');
    buyer = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Gốm Chờ Duyệt', slug: 'gom-cho-duyet', history: 'Khai báo.' },
    });
    household = applied.body;
    const boundary = 'vcraftboundary';
    const upload = await t.app.inject({
      method: 'POST',
      url: '/api/v1/media?purpose=CERTIFICATE',
      headers: {
        authorization: rep.auth,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="cccd.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
        ),
        PDF,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]),
    });
    expect(upload.statusCode).toBe(202);
    documentId = JSON.parse(upload.body).id;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('chỉ Admin vào được; số liệu đếm hồ sơ chờ', async () => {
    const denied = await t.request({ method: 'GET', url: '/admin/dashboard', auth: buyer.auth });
    expect(denied.status).toBe(403);
    const dayBefore = vietnamToday();
    const body = await dashboard();
    const dayAfter = vietnamToday();
    expect(body).toEqual({
      activeHouseholds: 0,
      pendingApplications: 1,
      openRfqs: 0,
      ordersInProduction: 0,
      qrScans30Days: 0,
      trend: expect.any(Array),
    });
    // The trend covers the last 30 Vietnam calendar dates including today, oldest first, zero-filled.
    expect(body.trend).toHaveLength(30);
    const dates: string[] = body.trend.map((point: { date: string }) => point.date);
    // The Vietnam day can change between the request and the assertion (around 17:00 UTC), so accept either.
    expect([dayBefore, dayAfter]).toContain(dates[29]);
    for (let i = 1; i < dates.length; i++) {
      expect(Date.parse(`${dates[i]}T00:00:00Z`) - Date.parse(`${dates[i - 1]}T00:00:00Z`)).toBe(
        24 * 60 * 60 * 1000,
      );
    }
    expect(body.trend.every((point: { count: number }) => point.count === 0)).toBe(true);
  });

  it('hàng đợi lọc theo trạng thái và ngày nộp', async () => {
    const get = (qs: string) =>
      t.request({ method: 'GET', url: `/admin/households?${qs}`, auth: admin.auth });
    expect((await get('status=PENDING_REVIEW')).body.data).toEqual([
      expect.objectContaining({ id: household.id, name: 'Gốm Chờ Duyệt' }),
    ]);
    expect((await get('status=APPROVED')).body.data).toEqual([]);
    expect((await get('to=2000-01-01')).body.data).toEqual([]);
    expect((await get('from=2000-01-01')).body.data).toHaveLength(1);
    expect((await get('from=khong-phai-ngay')).status).toBe(422);
  });

  it('giấy tờ: Admin thấy và lấy được URL ký; người khác thì không', async () => {
    const url = `/admin/households/${household.id}/documents`;
    const docs = await t.request({ method: 'GET', url, auth: admin.auth });
    expect(docs.body.data).toEqual([expect.objectContaining({ id: documentId })]);
    expect((await t.request({ method: 'GET', url, auth: buyer.auth })).status).toBe(403);
    const signed = await t.request({
      method: 'GET',
      url: `/media/${documentId}/read-url`,
      auth: admin.auth,
    });
    expect(signed.status).toBe(200);
    expect(signed.body.url).toMatch(/signature=/);
    const stranger = await t.request({
      method: 'GET',
      url: `/media/${documentId}/read-url`,
      auth: (await t.createUser('HOUSEHOLD')).auth,
    });
    expect(stranger.status).toBe(404);
  });

  it('yêu cầu bổ sung cần lý do, giữ trạng thái chờ, hộ thấy lý do', async () => {
    expect((await decide('request-info', household.version)).status).toBe(422);
    const res = await decide('request-info', household.version, { reason: 'Thiếu giấy cư trú' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'PENDING_REVIEW', statusReason: 'Thiếu giấy cư trú' });
    household = res.body;
  });

  it('từ chối thiếu lý do bị chặn; duyệt ghi audit và xếp email', async () => {
    expect((await decide('reject', household.version)).status).toBe(422);
    expect((await decide('approve', household.version - 1)).status).toBe(409);
    const res = await decide('approve', household.version);
    expect(res.status).toBe(200);
    expect(res.body.statusReason).toBeNull();
    household = res.body;

    const em = db.orm.em.fork();
    const audit = await em.find(AuditLog, { entityId: household.id });
    expect(audit.map((a) => a.action).sort()).toEqual([
      'household.approve',
      'household.request_info',
    ]);
    const events = await em.find(OutboxEvent, { type: 'household.decision' });
    expect(events.map((e) => (e.payload as { decision: string }).decision).sort()).toEqual([
      'APPROVE',
      'REQUEST_INFO',
    ]);
    expect((await dashboard()).activeHouseholds).toBe(1);
  });

  it('khóa hộ: sản phẩm biến khỏi danh mục, QR cảnh báo; mở khóa thì hiện lại; quét được đếm', async () => {
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình chờ khóa', category: 'VASE' },
    });
    await addMilestone(t, rep, created.body.id, await createJournalPhoto(db, t, rep));
    await t.request({
      method: 'POST',
      url: `/products/${created.body.id}/publish`,
      auth: rep.auth,
      headers: { 'if-match': `"${created.body.version}"` },
    });
    const code = created.body.traceCode as string;
    const catalog = async () =>
      (await t.request({ method: 'GET', url: '/products' })).body.data.length;
    expect(await catalog()).toBe(1);

    const dayBefore = vietnamToday();
    expect((await t.request({ method: 'POST', url: `/trace/${code}/scan` })).status).toBe(204);
    expect((await t.request({ method: 'POST', url: '/trace/ZZZZZZZZ/scan' })).status).toBe(204);
    const body = await dashboard();
    const dayAfter = vietnamToday();
    expect(body.qrScans30Days).toBe(1);
    // The scan lands in today's Vietnam calendar bucket; every other date stays zero. The day may roll over
    // between the scan request and the assertion, so the one scan must sit in the day before or after it.
    const scanDays = new Set([dayBefore, dayAfter]);
    const inScanDays = body.trend
      .filter((point: { date: string }) => scanDays.has(point.date))
      .reduce((sum: number, point: { count: number }) => sum + point.count, 0);
    expect(inScanDays).toBe(1);
    expect(body.trend.reduce((sum: number, point: { count: number }) => sum + point.count, 0)).toBe(
      body.qrScans30Days,
    );
    const visible = await t.request({ method: 'GET', url: `/trace/${code}` });
    expect(visible.body.scanCount).toBe(1);

    const locked = await decide('suspend', household.version, { reason: 'Nghi hàng nhái' });
    expect(locked.status).toBe(200);
    expect(await catalog()).toBe(0);
    const trace = await t.request({ method: 'GET', url: `/trace/${code}` });
    expect(trace.body).toMatchObject({
      availability: 'UNAVAILABLE',
      reason: 'HOUSEHOLD_SUSPENDED',
    });

    const unlocked = await decide('reinstate', locked.body.version);
    expect(unlocked.status).toBe(200);
    expect(await catalog()).toBe(1);
  });

  it('counts the trend by Vietnam calendar date, including a scan at the window edge (vCRAFT-8my.4)', async () => {
    // Self-contained: approve the household if an earlier test has not, then create a product.
    const em = db.orm.em.fork();
    await em.nativeUpdate(Household, { slug: 'gom-cho-duyet' }, { status: 'APPROVED' });
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: rep.auth,
      body: { name: 'Bình biên ngày', category: 'VASE' },
    });
    expect(created.status).toBe(201);

    const dayBefore = vietnamToday();
    const before = await dashboard();
    const countAt = (body: Awaited<ReturnType<typeof dashboard>>, date: string) =>
      (body.trend as { date: string; count: number }[]).find((p) => p.date === date)?.count ?? 0;
    const firstDate = trendFirstDate();
    const today = dayBefore;

    // A scan one minute before the first window's Vietnam midnight sits outside the window; one
    // minute inside it and one now prove the UTC+7 bucketing, independent of the server's zone.
    const windowStart = new Date(Date.parse(`${firstDate}T00:00:00+07:00`));
    const scans: Date[] = [
      new Date(windowStart.getTime() - 60_000),
      new Date(windowStart.getTime() + 60_000),
      new Date(),
    ];
    const product = await em.findOneOrFail(Product, { traceCode: created.body.traceCode });
    for (const createdAt of scans) {
      const scan = em.create(TraceScan, { product, country: null, deviceType: null });
      scan.createdAt = createdAt;
    }
    await em.flush();

    const body = await dashboard();
    // The Vietnam day rolled over during the test (around 17:00 UTC): the window moved, so the exact
    // bucket counts below no longer apply. The next run is deterministic again.
    if (vietnamToday() !== dayBefore) return;
    // The scan before the window stays out; the two in-window scans land in their Vietnam buckets.
    expect(body.qrScans30Days).toBe(before.qrScans30Days + 2);
    expect(countAt(body, firstDate)).toBe(countAt(before, firstDate) + 1);
    expect(countAt(body, today)).toBe(countAt(before, today) + 1);
    expect(body.trend.reduce((sum: number, point: { count: number }) => sum + point.count, 0)).toBe(
      body.qrScans30Days,
    );
  });
});

/** Today's date in Vietnam (UTC+7) as YYYY-MM-DD. */
function vietnamToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** First date of the dashboard trend window: today's Vietnam date minus 29 days. */
function trendFirstDate(): string {
  const today = vietnamToday();
  return new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
