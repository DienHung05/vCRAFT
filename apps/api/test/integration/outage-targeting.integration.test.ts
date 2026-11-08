import { News } from '@vcraft/database';
import { villageToday } from '@vcraft/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../../src/common/auth/auth.guard.js';
import { NewsService } from '../../src/modules/news/application/news.service.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

type Area = 'BAT_TRANG' | 'GIANG_CAO' | undefined;

/**
 * GH#294 (ADR-0023): power-outage notices reach the households whose workshops are in the notice area, plus
 * village-wide and legacy notices; a household with no workshop area gets every notice. The banner runs
 * from 00:00 of the village date until the cut ends.
 */
describe('Outage targeting by area', () => {
  let db: TestDatabase;
  let t: TestApp;
  let news: NewsService;
  let admin: { id: string; auth: string };
  let buyer: { auth: string };
  /** Approved households by what their workshops say. */
  const households: Record<string, { id: string; auth: string; email: string }> = {};
  let applicant: { auth: string };
  const today = villageToday();

  const publish = async (
    outage: { areaCode?: string; area: string; date?: string; from?: string; to?: string },
    title = outage.area,
  ) => {
    const res = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: {
        title: `Lịch cắt điện ${title}`,
        summary: 'Tóm tắt',
        bodyHtml: '<p>Nội dung</p>',
        category: 'POWER_SCHEDULE',
        visibility: 'VILLAGE',
        pinned: false,
        important: false,
        status: 'PUBLISHED',
        powerSchedule: {
          outages: [{ date: today, from: '00:00', to: '23:59', ...outage }],
        },
      },
    });
    expect(res.status).toBe(201);
    return res.body as { id: string; slug: string };
  };

  const outagesFor = async (auth?: string) =>
    t.request({ method: 'GET', url: '/news/village/outages', auth });
  const areasFor = async (auth: string) =>
    ((await outagesFor(auth)).body.outages as { area: string }[]).map((o) => o.area).sort();

  const addHousehold = async (name: string, slug: string, workshopAreas: Area[]) => {
    const rep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name, slug, history: '' },
    });
    expect(applied.status).toBe(201);
    for (const [i, areaCode] of workshopAreas.entries()) {
      const added = await t.request({
        method: 'POST',
        url: '/me/household/workshops',
        auth: rep.auth,
        body: {
          name: `Xưởng ${i + 1}`,
          address: 'Bát Tràng, Gia Lâm, Hà Nội',
          ...(areaCode && { areaCode }),
        },
      });
      expect(added.status).toBe(201);
      expect(added.body.areaCode).toBe(areaCode ?? null);
    }
    return { rep, applied };
  };

  const approve = (applied: { body: { id: string; version: number } }) =>
    t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': String(applied.body.version) },
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    news = t.app.get(NewsService);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');

    for (const [key, areas] of Object.entries({
      batTrang: ['BAT_TRANG'],
      giangCao: ['GIANG_CAO'],
      both: ['BAT_TRANG', 'GIANG_CAO'],
      unset: [undefined],
      none: [],
      editable: ['BAT_TRANG'],
    }) as [string, Area[]][]) {
      const { rep, applied } = await addHousehold(`Hộ ${key}`, `ho-${key.toLowerCase()}`, areas);
      expect((await approve(applied)).status).toBe(200);
      households[key] = rep;
    }
    // An applicant that is never approved, with a workshop in Giang Cao.
    applicant = (await addHousehold('Hộ chờ duyệt', 'ho-cho-duyet', ['GIANG_CAO'])).rep;
  }, 240_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('sends a hamlet notice to the households in that hamlet, a multi-workshop household and those with no area', async () => {
    const notice = await publish({ areaCode: 'GIANG_CAO', area: 'Xóm 3 Giang Cao' });

    const giangCao = await outagesFor(households.giangCao?.auth);
    expect(giangCao.status).toBe(200);
    expect(giangCao.body.outages).toEqual([
      {
        from: '00:00',
        to: '23:59',
        area: 'Xóm 3 Giang Cao',
        areaCode: 'GIANG_CAO',
        newsSlug: notice.slug,
      },
    ]);
    expect(giangCao.body.needsWorkshopArea).toBe(false);

    // Unaffected: its only workshop is in the other hamlet.
    const batTrang = await outagesFor(households.batTrang?.auth);
    expect(batTrang.status).toBe(200);
    expect(batTrang.body.outages).toEqual([]);
    expect(batTrang.body.needsWorkshopArea).toBe(false);

    // Affected: one of two workshops is in Giang Cao.
    expect(await areasFor(households.both?.auth as string)).toEqual(['Xóm 3 Giang Cao']);
    // No workshop area set (or no workshop at all): warned about everything, and asked to set it.
    for (const key of ['unset', 'none']) {
      const res = await outagesFor(households[key]?.auth);
      expect(res.body.outages).toHaveLength(1);
      expect(res.body.needsWorkshopArea).toBe(true);
    }
    // An administrator sees every cut and gets no prompt.
    const adminView = await outagesFor(admin.auth);
    expect(adminView.status).toBe(200);
    expect(adminView.body.outages).toHaveLength(1);
    expect(adminView.body.needsWorkshopArea).toBe(false);
  });

  it('sends village-wide and legacy notices to everyone, whatever the free text says', async () => {
    await publish({ areaCode: 'VILLAGE_WIDE', area: 'Toàn xã' });
    // Legacy: no area code, free text names Giang Cao, and it must not be mapped from the text.
    const legacy = await publish({ area: 'Thôn Giang Cao' }, 'cũ');

    expect(await areasFor(households.batTrang?.auth as string)).toEqual([
      'Thôn Giang Cao',
      'Toàn xã',
    ]);
    expect(await areasFor(households.giangCao?.auth as string)).toEqual([
      'Thôn Giang Cao',
      'Toàn xã',
      'Xóm 3 Giang Cao',
    ]);
    const shown = (await outagesFor(households.batTrang?.auth)).body.outages.find(
      (o: { newsSlug: string }) => o.newsSlug === legacy.slug,
    );
    expect(shown.areaCode).toBe('VILLAGE_WIDE');
  });

  it('keeps authorization and private no-store caching', async () => {
    const approved = await outagesFor(households.batTrang?.auth);
    expect(String(approved.headers['cache-control'])).toContain('no-store');
    expect(String(approved.headers['cache-control'])).toContain('private');

    // A pending applicant, a buyer and a guest get no outage data.
    expect((await outagesFor(applicant.auth)).status).toBe(404);
    expect((await outagesFor(buyer.auth)).status).toBe(403);
    expect((await outagesFor()).status).toBe(401);
  });

  it('follows the workshop area when the household edits it, and keeps it when the field is left out', async () => {
    const rep = households.editable as { auth: string };
    const household = await t.request({ method: 'GET', url: '/me/household', auth: rep.auth });
    const [workshop] = household.body.workshops;
    expect(workshop.areaCode).toBe('BAT_TRANG');
    const body = { name: workshop.name, address: workshop.address };

    // Left out: the stored area is kept.
    const kept = await t.request({
      method: 'PUT',
      url: `/me/household/workshops/${workshop.id}`,
      auth: rep.auth,
      body,
      headers: { 'if-match': String(workshop.version) },
    });
    expect(kept.status).toBe(200);
    expect(kept.body.areaCode).toBe('BAT_TRANG');

    // An unknown hamlet is refused.
    const unknown = await t.request({
      method: 'PUT',
      url: `/me/household/workshops/${workshop.id}`,
      auth: rep.auth,
      body: { ...body, areaCode: 'KIM_LAN' },
      headers: { 'if-match': String(kept.body.version) },
    });
    expect(unknown.status).toBe(422);

    // Moved to Giang Cao: now it gets the Giang Cao notice.
    const moved = await t.request({
      method: 'PUT',
      url: `/me/household/workshops/${workshop.id}`,
      auth: rep.auth,
      body: { ...body, areaCode: 'GIANG_CAO' },
      headers: { 'if-match': String(kept.body.version) },
    });
    expect(moved.body.areaCode).toBe('GIANG_CAO');
    expect(await areasFor(rep.auth)).toContain('Xóm 3 Giang Cao');

    // Cleared: warned about everything, with the prompt.
    const cleared = await t.request({
      method: 'PUT',
      url: `/me/household/workshops/${workshop.id}`,
      auth: rep.auth,
      body: { ...body, areaCode: null },
      headers: { 'if-match': String(moved.body.version) },
    });
    expect(cleared.body.areaCode).toBeNull();
    expect((await outagesFor(rep.auth)).body.needsWorkshopArea).toBe(true);
  });

  it('shows the area to the administrator reviewing the household', async () => {
    const review = await t.request({
      method: 'GET',
      url: `/admin/households/${(await t.request({ method: 'GET', url: '/me/household', auth: households.giangCao?.auth })).body.id}`,
      auth: admin.auth,
    });
    expect(review.status).toBe(200);
    expect(review.body.workshops.map((w: { areaCode: string }) => w.areaCode)).toEqual([
      'GIANG_CAO',
    ]);
  });

  describe('time window at a fixed clock', () => {
    const cutDate = '2026-11-09';
    const actorOf = (user: { id: string; email: string }): Actor => ({
      id: user.id,
      email: user.email,
      role: 'HOUSEHOLD',
      locked: false,
      aal: 'aal2',
    });
    // Village time is UTC+7.
    const village = (time: string, date = cutDate) => new Date(`${date}T${time}:00+07:00`);

    beforeAll(async () => {
      // A cut on a fixed date, with its notice published long before, so the clock decides what shows.
      const notice = await publish(
        { areaCode: 'GIANG_CAO', area: 'Cố định', date: cutDate, from: '08:00', to: '11:30' },
        'cố định',
      );
      await db.orm.em
        .fork()
        .nativeUpdate(News, { id: notice.id }, { publishedAt: new Date('2026-01-01') });
    });

    const shown = async (user: { id: string; email: string }, now: Date) =>
      (await news.todayOutages(actorOf(user), now)).outages
        .filter((o) => o.area === 'Cố định')
        .map((o) => `${o.from}-${o.to}`);

    it('warns from 00:00 of the village date, through the cut, and not after its end', async () => {
      const giangCao = households.giangCao as { id: string; email: string };
      expect(await shown(giangCao, village('23:59', '2026-11-08'))).toEqual([]);
      expect(await shown(giangCao, village('00:00'))).toEqual(['08:00-11:30']);
      expect(await shown(giangCao, village('07:59'))).toEqual(['08:00-11:30']);
      expect(await shown(giangCao, village('09:00'))).toEqual(['08:00-11:30']);
      expect(await shown(giangCao, village('11:29'))).toEqual(['08:00-11:30']);
      expect(await shown(giangCao, village('11:30'))).toEqual([]);
      expect(await shown(giangCao, village('23:59'))).toEqual([]);
      expect(await shown(giangCao, village('00:00', '2026-11-10'))).toEqual([]);
    });

    it('applies the same window to every audience, but only to those the cut reaches', async () => {
      const at = village('09:00');
      expect(await shown(households.batTrang as { id: string; email: string }, at)).toEqual([]);
      expect(await shown(households.both as { id: string; email: string }, at)).toEqual([
        '08:00-11:30',
      ]);
      expect(await shown(households.unset as { id: string; email: string }, at)).toEqual([
        '08:00-11:30',
      ]);
      expect(
        await shown(households.unset as { id: string; email: string }, village('12:00')),
      ).toEqual([]);
    });
  });
});
