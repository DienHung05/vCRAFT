import { AuditLog, Household, Product, TraceScan } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** GH#235 — QR scans record country and device class (FR-TRC-06); only the owner reads the statistics. */
describe('QR scan statistics', () => {
  let db: TestDatabase;
  let t: TestApp;
  let owner: { auth: string };
  let other: { auth: string };
  let product: { id: string; traceCode: string };

  const KEY = 'test-internal-key';
  let visitors = 0;
  // Each call is a new visitor unless one is named, so the dedupe (GH#362) does not hide earlier scans.
  const scan = (body?: unknown, code = product.traceCode, visitor = `198.51.100.${++visitors}`) =>
    t.request({
      method: 'POST',
      url: `/trace/${code}/scan`,
      headers: { 'x-internal-key': KEY, 'x-visitor-ip': visitor, 'x-visitor-ua': 'test' },
      ...(body !== undefined && { body }),
    });
  const stats = (auth: string | undefined, id = product.id) =>
    t.request({
      method: 'GET',
      url: `/me/household/products/${id}/scans`,
      ...(auth && { auth }),
    });

  beforeAll(async () => {
    process.env.INTERNAL_API_KEY = KEY;
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    for (const [user, slug] of [
      [owner, 'gom-quet-a'],
      [other, 'gom-quet-b'],
    ] as const) {
      await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hộ ${slug}`, slug, history: '' },
      });
    }
    await db.orm.em
      .fork()
      .nativeUpdate(
        Household,
        { slug: { $in: ['gom-quet-a', 'gom-quet-b'] } },
        { status: 'APPROVED' },
      );
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: owner.auth,
      body: { name: 'Bình quét', category: 'VASE', priceVnd: 500_000, stock: 1 },
    });
    expect(created.status).toBe(201);
    product = created.body;
    // Only a listed product counts scans.
    await db.orm.em.fork().nativeUpdate(Product, { id: product.id }, { status: 'PUBLISHED' });
  }, 120_000);

  afterAll(async () => {
    delete process.env.INTERNAL_API_KEY;
    await t?.close();
    await db?.stop();
  });

  it('stores country and device class from the body; an old client with no body still gets 204', async () => {
    expect((await scan({ country: 'VN', deviceType: 'mobile' })).status).toBe(204);
    expect((await scan({ country: 'US', deviceType: 'desktop' })).status).toBe(204);
    expect((await scan({ country: 'VN', deviceType: 'mobile' })).status).toBe(204);
    expect((await scan()).status).toBe(204);
    // A code that does not exist still answers 204 and records nothing.
    expect((await scan({ country: 'VN' }, 'ZZZZZZZZ')).status).toBe(204);

    const rows = await db.orm.em.fork().find(TraceScan, { product: product.id });
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.country === 'VN' && r.deviceType === 'mobile')).toHaveLength(2);
    expect(rows.filter((r) => r.country === null && r.deviceType === null)).toHaveLength(1);
  });

  it('rejects a malformed country or device class', async () => {
    expect((await scan({ country: 'vn' })).status).toBe(422);
    expect((await scan({ country: 'VNM' })).status).toBe(422);
    expect((await scan({ deviceType: 'toaster' })).status).toBe(422);
  });

  it('gives the owner the totals, a 30-day series and the breakdowns', async () => {
    // An old scan counts in the total but not in the last 30 days.
    const em = db.orm.em.fork();
    const old = em.create(TraceScan, {
      product: em.getReference(Product, product.id),
      country: 'FR',
    });
    old.createdAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await em.flush();

    const res = await stats(owner.auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.last30Days).toBe(4);
    expect(res.body.daily).toHaveLength(30);
    expect(res.body.daily.reduce((n: number, d: { count: number }) => n + d.count, 0)).toBe(4);
    expect(res.body.byCountry[0]).toEqual({ country: 'VN', count: 2 });
    expect(res.body.byCountry).toEqual(
      expect.arrayContaining([
        { country: 'VN', count: 2 },
        { country: 'US', count: 1 },
        { country: null, count: 1 },
      ]),
    );
    expect(res.body.byCountry.some((c: { country: string | null }) => c.country === 'FR')).toBe(
      false,
    );
    expect(res.body.byDeviceType).toEqual(
      expect.arrayContaining([
        { deviceType: 'mobile', count: 2 },
        { deviceType: 'desktop', count: 1 },
        { deviceType: null, count: 1 },
      ]),
    );
  });

  it('counts a visitor once per window, a different visitor separately (GH#362)', async () => {
    const count = () => db.orm.em.fork().count(TraceScan, { product: product.id });
    const before = await count();
    expect((await scan({ country: 'VN' }, product.traceCode, '192.0.2.1')).status).toBe(204);
    expect((await scan({ country: 'VN' }, product.traceCode, '192.0.2.1')).status).toBe(204);
    expect(await count()).toBe(before + 1);
    expect((await scan({ country: 'VN' }, product.traceCode, '192.0.2.2')).status).toBe(204);
    expect(await count()).toBe(before + 2);
  });

  it('does not trust or dedupe X-Visitor-IP without the shared secret (GH#362)', async () => {
    const count = () => db.orm.em.fork().count(TraceScan, { product: product.id });
    const before = await count();
    const spoof = (ip: string) =>
      t.request({
        method: 'POST',
        url: `/trace/${product.traceCode}/scan`,
        headers: { 'x-visitor-ip': ip, 'x-internal-key': 'wrong' },
      });
    expect((await spoof('192.0.2.50')).status).toBe(204);
    expect((await spoof('192.0.2.51')).status).toBe(204);
    // Untrusted forwarded visitors are counted without dedupe (the web without the secret must not
    // collapse every visitor into its own address); trusted ones dedupe as tested above.
    expect(await count()).toBe(before + 2);
  });

  it("denies another household's product with an audited 403, and anonymous callers", async () => {
    expect((await stats(other.auth)).status).toBe(403);
    const denied = await db.orm.em
      .fork()
      .find(AuditLog, { action: 'access.denied', entityId: product.id });
    expect(denied).toHaveLength(1);
    expect((await stats(undefined)).status).toBe(401);
    expect((await stats(owner.auth, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('does not store or count crawler scans (GH#483)', async () => {
    const publicCount = async () =>
      (await t.request({ method: 'GET', url: `/trace/${product.traceCode}` })).body
        .scanCount as number;
    const stored = () => db.orm.em.fork().count(TraceScan, { product: product.id });
    const beforePublic = await publicCount();
    const beforeStored = await stored();
    const beforeOwner = (await stats(owner.auth)).body;

    // The web reports a bot class; a client that sends a crawler User-Agent without it is caught too.
    expect((await scan({ country: 'US', deviceType: 'bot' })).status).toBe(204);
    expect(
      (
        await t.request({
          method: 'POST',
          url: `/trace/${product.traceCode}/scan`,
          headers: {
            'x-internal-key': KEY,
            'x-visitor-ip': '203.0.113.77',
            'x-visitor-ua':
              'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
          },
          body: { country: 'US', deviceType: 'desktop' },
        })
      ).status,
    ).toBe(204);
    expect(await stored()).toBe(beforeStored);
    expect(await publicCount()).toBe(beforePublic);

    // A rows written before this fix carry the bot class; they are excluded from every figure.
    const em = db.orm.em.fork();
    em.create(TraceScan, {
      product: em.getReference(Product, product.id),
      country: 'US',
      deviceType: 'bot',
    });
    await em.flush();
    expect(await publicCount()).toBe(beforePublic);
    const afterOwner = (await stats(owner.auth)).body;
    expect(afterOwner.total).toBe(beforeOwner.total);
    expect(afterOwner.last30Days).toBe(beforeOwner.last30Days);
    expect(afterOwner.byDeviceType).toEqual(beforeOwner.byDeviceType);
    await em.nativeDelete(TraceScan, { product: product.id, deviceType: 'bot' });

    // A phone scan counts by one, in the public figure and in the owner's total.
    expect((await scan({ country: 'VN', deviceType: 'mobile' })).status).toBe(204);
    expect(await publicCount()).toBe(beforePublic + 1);
    expect((await stats(owner.auth)).body.total).toBe(beforeOwner.total + 1);
  });
});
