import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';
import { pinVillageClock, releaseVillageClock } from './support/village-clock.js';

/**
 * Issue #92 (PLAN E11): structured material price and power outage news. Prices feed the public
 * six-month series; today's outages reach approved households for the Studio banner.
 */
describe('Material prices and power outage news', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { auth: string };
  let household: { auth: string };
  let buyer: { auth: string };
  // Set in beforeAll from the pinned clock (10:00 village time), so no test depends on the time of day.
  let today: string;
  let thisMonth: string;

  const base = (category: string) => ({
    title: `Tin ${category} ${Math.random()}`,
    summary: 'Tóm tắt',
    bodyHtml: '<p>Nội dung</p>',
    category,
    visibility: 'PUBLIC',
    pinned: false,
    important: false,
    status: 'PUBLISHED',
  });

  const create = (body: object) =>
    t.request({ method: 'POST', url: '/admin/news', auth: admin.auth, body });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    today = pinVillageClock();
    thisMonth = today.slice(0, 7);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'Hộ tin', slug: 'ho-tin', history: '' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });
    household = rep;
  }, 240_000);

  afterAll(async () => {
    releaseVillageClock();
    await t?.close();
    await db?.stop();
  });

  it('stores prices on a price notice and charts them', async () => {
    const res = await create({
      ...base('MATERIAL_PRICES'),
      materialPrices: {
        effectiveOn: `${thisMonth}-01`,
        prices: [
          { material: 'CLAY', unit: 'tấn', priceVnd: 1_250_000 },
          { material: 'GAS', unit: 'bình 12 kg', priceVnd: 470_000 },
        ],
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.materialPrices.prices).toHaveLength(2);

    const detail = await t.request({ method: 'GET', url: `/news/${res.body.slug}` });
    expect(detail.body.materialPrices.effectiveOn).toBe(`${thisMonth}-01`);

    const series = await t.request({ method: 'GET', url: '/news/material-prices' });
    expect(series.status).toBe(200);
    const clay = series.body.series.find((s: { material: string }) => s.material === 'CLAY');
    expect(clay.points.at(-1)).toEqual({ month: thisMonth, priceVnd: 1_250_000 });
  });

  it('refuses structured content on the wrong category and malformed outages', async () => {
    const wrong = await create({
      ...base('GENERAL'),
      materialPrices: {
        effectiveOn: `${thisMonth}-01`,
        prices: [{ material: 'CLAY', unit: 'tấn', priceVnd: 1 }],
      },
    });
    expect(wrong.status).toBe(422);
    const backwards = await create({
      ...base('POWER_SCHEDULE'),
      powerSchedule: { outages: [{ date: today, from: '12:00', to: '08:00', area: 'Xóm 1' }] },
    });
    expect(backwards.status).toBe(422);
  });

  it('shows today’s cuts to approved households only', async () => {
    const res = await create({
      ...base('POWER_SCHEDULE'),
      visibility: 'VILLAGE',
      powerSchedule: {
        outages: [
          // The clock is pinned at 10:00: a cut ending later is still to come, one that ended is hidden.
          { date: today, from: '13:30', to: '17:00', area: 'Giang Cao' },
          { date: today, from: '08:00', to: '12:00', area: 'Xóm 2' },
          { date: today, from: '06:00', to: '09:30', area: 'Đã xong' },
          { date: '2000-01-01', from: '08:00', to: '09:00', area: 'Quá khứ' },
        ],
      },
    });
    expect(res.status).toBe(201);
    const outages = await t.request({
      method: 'GET',
      url: '/news/village/outages',
      auth: household.auth,
    });
    expect(outages.status).toBe(200);
    expect(outages.body.date).toBe(today);
    expect(outages.body.outages.map((o: { area: string }) => o.area)).toEqual([
      'Xóm 2',
      'Giang Cao',
    ]);
    expect(outages.body.outages[0].newsSlug).toBe(res.body.slug);

    expect(
      (await t.request({ method: 'GET', url: '/news/village/outages', auth: buyer.auth })).status,
    ).toBe(403);
    expect((await t.request({ method: 'GET', url: '/news/village/outages' })).status).toBe(401);
  });
});
