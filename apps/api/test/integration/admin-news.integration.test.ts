import {
  AuditLog,
  News,
  Notification,
  notifyDueImportantNews,
  OutboxEvent,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Issue #30: admin news management, visibility, scheduling, sanitizing and notifications. */
describe('Admin news', () => {
  let db: TestDatabase;
  let t: TestApp;
  let admin: { id: string; auth: string };
  let buyer: { auth: string };
  let rep: { id: string; auth: string };
  let pendingRep: { auth: string };

  const body = (overrides: object = {}) => ({
    title: 'Giá men tháng này',
    summary: 'Tóm tắt',
    bodyHtml: '<p>Nội dung <strong>chính</strong></p>',
    category: 'MATERIAL_PRICES',
    visibility: 'PUBLIC',
    pinned: false,
    important: false,
    status: 'PUBLISHED',
    ...overrides,
  });
  const create = async (overrides: object = {}) => {
    const res = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: body(overrides),
    });
    expect(res.status).toBe(201);
    return res.body;
  };
  const notifications = async (recipientId: string, subjectId: string) =>
    db.orm.em.fork().count(Notification, { recipientId, subjectId, type: 'NEWS_PUBLISHED' });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
    rep = await t.createUser('BUYER');
    pendingRep = await t.createUser('BUYER');
    const applied = await t.request({
      method: 'POST',
      url: '/me/household',
      auth: rep.auth,
      body: { name: 'News household', slug: 'news-household', history: '' },
    });
    await t.request({
      method: 'POST',
      url: `/admin/households/${applied.body.id}/approve`,
      auth: admin.auth,
      headers: { 'if-match': `"${applied.body.version}"` },
    });
    await t.request({
      method: 'POST',
      url: '/me/household',
      auth: pendingRep.auth,
      body: { name: 'Pending news household', slug: 'pending-news-household', history: '' },
    });
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('is admin-only', async () => {
    for (const auth of [buyer.auth, rep.auth]) {
      const list = await t.request({ method: 'GET', url: '/admin/news', auth });
      expect(list.status).toBe(403);
      const post = await t.request({ method: 'POST', url: '/admin/news', auth, body: body() });
      expect(post.status).toBe(403);
    }
    expect((await t.request({ method: 'GET', url: '/admin/news' })).status).toBe(401);
  });

  it('strips scripts, event handlers and unsafe links before storing', async () => {
    const created = await create({
      title: 'Sanitized',
      bodyHtml:
        '<h2>Safe</h2><script>alert(1)</script><p onclick="alert(2)">Text <a href="javascript:alert(3)">bad</a> <a href="https://example.com">good</a></p><img src=x onerror=alert(4)><iframe src="https://evil.test"></iframe>',
    });
    const article = await t.request({ method: 'GET', url: `/news/${created.slug}` });
    expect(article.status).toBe(200);
    const html: string = article.body.bodyHtml;
    expect(html).toContain('<h2>Safe</h2>');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    for (const bad of ['script', 'onclick', 'javascript:', 'onerror', 'iframe', '<img'])
      expect(html).not.toContain(bad);
    expect(article.body.body).toContain('Safe');
    expect(article.body.body).not.toContain('<');
  });

  it('refuses a body with no text in it', async () => {
    const res = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: body({ bodyHtml: '<script>alert(1)</script>' }),
    });
    expect(res.status).toBe(422);
  });

  it('derives a unique slug, and rejects a taken or reserved one', async () => {
    const first = await create({ title: 'Tin trùng tên' });
    const second = await create({ title: 'Tin trùng tên' });
    expect(first.slug).toBe('tin-trung-ten');
    expect(second.slug).toBe('tin-trung-ten-2');
    const taken = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: body({ slug: first.slug }),
    });
    expect(taken.status).toBe(409);
    const reserved = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: body({ slug: 'village' }),
    });
    expect(reserved.status).toBe(422);
  });

  it('stores the source of a story, shows it publicly and keeps the origin admin-only (GH#314)', async () => {
    const source = {
      sourceName: 'Hà Nội Mới',
      sourceUrl: 'https://hanoimoi.vn/bai-viet-goc',
      sourcePublishedAt: '2026-08-29T05:00:00.000Z',
    };
    const created = await create({ title: 'Tin có nguồn', ...source });
    expect(created).toMatchObject({ ...source, origin: 'MANUAL' });

    const detail = await t.request({ method: 'GET', url: `/news/${created.slug}` });
    expect(detail.body).toMatchObject(source);
    const list = await t.request({ method: 'GET', url: '/news?limit=50' });
    const card = list.body.data.find((n: { slug: string }) => n.slug === created.slug);
    expect(card).toMatchObject(source);
    // The origin is an admin-only field: no public DTO carries it.
    expect(JSON.stringify(detail.body)).not.toMatch(/origin|IMPORTED|GENERATED/);
    expect(JSON.stringify(list.body)).not.toMatch(/origin|IMPORTED|GENERATED/);

    const put = (version: number, overrides: object) =>
      t.request({
        method: 'PUT',
        url: `/admin/news/${created.id}`,
        auth: admin.auth,
        headers: { 'if-match': `"${version}"` },
        body: body({ title: 'Tin có nguồn', ...overrides }),
      });
    // Leaving the source out keeps it; null clears it, and clearing the publisher clears the link too.
    const kept = await put(created.version, {});
    expect(kept.body).toMatchObject(source);
    const cleared = await put(kept.body.version, { sourceName: null });
    expect(cleared.body).toMatchObject({ sourceName: null, sourceUrl: null });
    const clearedDate = await put(cleared.body.version, { sourcePublishedAt: null });
    expect(clearedDate.body.sourcePublishedAt).toBeNull();
  });

  it('rejects a source link that is not https or has no publisher', async () => {
    for (const overrides of [
      { sourceName: 'Báo', sourceUrl: 'http://insecure.example/a' },
      { sourceName: 'Báo', sourceUrl: 'javascript:alert(1)' },
      { sourceUrl: 'https://example.vn/a' },
      { sourceName: 'x'.repeat(121) },
    ]) {
      const res = await t.request({
        method: 'POST',
        url: '/admin/news',
        auth: admin.auth,
        body: body(overrides),
      });
      expect([400, 422], JSON.stringify(overrides)).toContain(res.status);
    }
  });

  it('filters the admin list by origin', async () => {
    const em = db.orm.em.fork();
    const imported = em.create(News, {
      slug: 'tin-nhap-tu-dong',
      title: 'Tin nhập tự động',
      summary: 'Tóm tắt',
      body: 'Nội dung',
      category: 'GENERAL',
      status: 'PUBLISHED',
      publishedAt: new Date(Date.now() - 60_000),
      origin: 'IMPORTED',
      sourceName: 'Báo A',
      sourceUrl: 'https://baoa.vn/x',
    });
    await em.flush();
    const only = await t.request({
      method: 'GET',
      url: '/admin/news?origin=IMPORTED&limit=50',
      auth: admin.auth,
    });
    expect(only.status).toBe(200);
    expect(only.body.data.map((n: { id: string }) => n.id)).toContain(imported.id);
    expect(only.body.data.every((n: { origin: string }) => n.origin === 'IMPORTED')).toBe(true);
    const manual = await t.request({
      method: 'GET',
      url: '/admin/news?origin=MANUAL&limit=50',
      auth: admin.auth,
    });
    expect(manual.body.data.map((n: { id: string }) => n.id)).not.toContain(imported.id);
    const bad = await t.request({
      method: 'GET',
      url: '/admin/news?origin=OTHER',
      auth: admin.auth,
    });
    expect(bad.status).toBe(422);
  });

  it('keeps drafts and scheduled items off the public site until their time', async () => {
    const draft = await create({ title: 'Draft item', status: 'DRAFT' });
    expect(draft.state).toBe('DRAFT');
    expect(draft.publishedAt).toBeNull();
    const scheduled = await create({
      title: 'Scheduled item',
      publishAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(scheduled.state).toBe('SCHEDULED');
    for (const item of [draft, scheduled])
      expect((await t.request({ method: 'GET', url: `/news/${item.slug}` })).status).toBe(404);
    const list = await t.request({ method: 'GET', url: '/news?limit=100' });
    const slugs = list.body.data.map((row: { slug: string }) => row.slug);
    expect(slugs).not.toContain(draft.slug);
    expect(slugs).not.toContain(scheduled.slug);

    const filtered = await t.request({
      method: 'GET',
      url: '/admin/news?state=SCHEDULED',
      auth: admin.auth,
    });
    expect(filtered.body.data.map((row: { id: string }) => row.id)).toEqual([scheduled.id]);
  });

  it('shows village news to approved households and admins only', async () => {
    const item = await create({ title: 'Village item', visibility: 'VILLAGE' });
    const read = (auth?: string) =>
      t.request({ method: 'GET', url: `/news/village/${item.slug}`, ...(auth ? { auth } : {}) });
    expect((await t.request({ method: 'GET', url: `/news/${item.slug}` })).status).toBe(404);
    expect((await read()).status).toBe(401);
    expect((await read(buyer.auth)).status).toBe(403);
    expect((await read(admin.auth)).status).toBe(200);
    const household = await read(rep.auth);
    expect(household.status).toBe(200);
    expect(household.body.visibility).toBe('VILLAGE');
    const publicList = await t.request({ method: 'GET', url: '/news?limit=100' });
    expect(publicList.body.data.map((row: { slug: string }) => row.slug)).not.toContain(item.slug);
    const villageList = await t.request({ method: 'GET', url: '/news/village', auth: rep.auth });
    expect(villageList.body.data.map((row: { slug: string }) => row.slug)).toContain(item.slug);
  });

  it('keeps a household that is not approved out of village news', async () => {
    const res = await t.request({ method: 'GET', url: '/news/village', auth: pendingRep.auth });
    expect(res.status).toBe(404);
  });

  it('notifies approved households once when important news goes live', async () => {
    const item = await create({ title: 'Important now', important: true });
    expect(await notifications(rep.id, item.id)).toBe(1);
    const edited = await t.request({
      method: 'PUT',
      url: `/admin/news/${item.id}`,
      auth: admin.auth,
      headers: { 'if-match': `"${item.version}"` },
      body: body({ title: 'Important edited', important: true }),
    });
    expect(edited.status).toBe(200);
    expect(await notifications(rep.id, item.id)).toBe(1);

    const quiet = await create({ title: 'Ordinary item' });
    expect(await notifications(rep.id, quiet.id)).toBe(0);
    const inbox = await t.request({ method: 'GET', url: '/me/notifications', auth: rep.auth });
    const notice = inbox.body.data.find((row: { type: string }) => row.type === 'NEWS_PUBLISHED');
    expect(notice.target).toEqual({ page: 'NEWS_ARTICLE', id: item.id });
    const byId = await t.request({ method: 'GET', url: `/news/${item.id}` });
    expect(byId.status).toBe(200);
  });

  it('removes the NEWS_PUBLISHED notifications of a deleted article and keeps the others', async () => {
    const doomed = await create({ title: 'Doomed important', important: true });
    const kept = await create({ title: 'Kept important', important: true });
    expect(await notifications(rep.id, doomed.id)).toBe(1);
    expect(await notifications(rep.id, kept.id)).toBe(1);
    const removed = await t.request({
      method: 'DELETE',
      url: `/admin/news/${doomed.id}`,
      auth: admin.auth,
      headers: { 'if-match': `"${doomed.version}"` },
    });
    expect(removed.status).toBe(204);
    expect(await notifications(rep.id, doomed.id)).toBe(0);
    expect(await notifications(rep.id, kept.id)).toBe(1);
  });

  it('notifies for scheduled important news only when the worker finds it due', async () => {
    const item = await create({
      title: 'Important later',
      important: true,
      publishAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(await notifications(rep.id, item.id)).toBe(0);
    await notifyDueImportantNews(db.orm);
    expect(await notifications(rep.id, item.id)).toBe(0);

    const later = new Date(Date.now() + 2 * 3_600_000);
    await notifyDueImportantNews(db.orm, later);
    expect(await notifications(rep.id, item.id)).toBe(1);
    await notifyDueImportantNews(db.orm, later);
    expect(await notifications(rep.id, item.id)).toBe(1);
    const em = db.orm.em.fork();
    expect((await em.findOneOrFail(News, item.id)).notifiedAt).toBeTruthy();
    expect(await em.count(OutboxEvent, { type: 'notification.created' })).toBeGreaterThan(0);
  });

  it('returns related news from the same category', async () => {
    const a = await create({ title: 'Related A', category: 'SUPPORT_POLICY' });
    const b = await create({ title: 'Related B', category: 'SUPPORT_POLICY' });
    await create({ title: 'Other category', category: 'POWER_SCHEDULE' });
    const article = await t.request({ method: 'GET', url: `/news/${a.slug}` });
    expect(article.body.related.map((row: { slug: string }) => row.slug)).toEqual([b.slug]);
  });

  it('audits create, update, publish, unpublish and delete with before and after', async () => {
    const auditFor = async (id: string) => {
      const res = await t.request({
        method: 'GET',
        url: '/admin/audit-log?limit=100',
        auth: admin.auth,
      });
      return res.body.data.filter((row: { entityId: string }) => row.entityId === id);
    };
    const put = (id: string, version: number, overrides: object) =>
      t.request({
        method: 'PUT',
        url: `/admin/news/${id}`,
        auth: admin.auth,
        headers: { 'if-match': `"${version}"` },
        body: body(overrides),
      });
    let item = await create({ title: 'Audited', status: 'DRAFT' });
    item = (await put(item.id, item.version, { title: 'Audited 2', status: 'DRAFT' })).body;
    item = (await put(item.id, item.version, { title: 'Audited 2', status: 'PUBLISHED' })).body;
    item = (await put(item.id, item.version, { title: 'Audited 2', status: 'DRAFT' })).body;
    const stale = await t.request({
      method: 'DELETE',
      url: `/admin/news/${item.id}`,
      auth: admin.auth,
      headers: { 'if-match': '"1"' },
    });
    expect(stale.status).toBe(409);
    const removed = await t.request({
      method: 'DELETE',
      url: `/admin/news/${item.id}`,
      auth: admin.auth,
      headers: { 'if-match': `"${item.version}"` },
    });
    expect(removed.status).toBe(204);
    const entries = await auditFor(item.id);
    expect(entries.map((row: { action: string }) => row.action).reverse()).toEqual([
      'news.create',
      'news.update',
      'news.publish',
      'news.unpublish',
      'news.delete',
    ]);
    expect(entries[0]).toMatchObject({ actorId: admin.id, after: null });
    expect(entries[0].before.title).toBe('Audited 2');
    // vCRAFT-8my.5: the deleted news keeps its title from the delete event's before snapshot.
    expect(entries[0].targetLabel).toBe('Audited 2');
    const gone = await t.request({
      method: 'GET',
      url: `/admin/news/${item.id}`,
      auth: admin.auth,
    });
    expect(gone.status).toBe(404);
  });

  it('audits a legacy entry without a snapshot label as null while the id stays', async () => {
    const em = db.orm.em.fork();
    const legacyId = '00000000-0000-4000-8000-0000000000e5';
    em.create(AuditLog, {
      actorId: admin.id,
      action: 'news.delete',
      entity: 'news',
      entityId: legacyId,
      before: null,
      after: null,
    });
    await em.flush();
    const res = await t
      .request({
        method: 'GET',
        url: `/admin/audit-log?limit=100&cursor=${Buffer.from(
          // A second ahead, so an entry written in the same millisecond is still before the cursor.
          JSON.stringify({ t: new Date(Date.now() + 1000).toISOString(), id: legacyId }),
        ).toString('base64url')}`,
        auth: admin.auth,
      })
      .then((page) =>
        page.body.data.filter((entry: { entityId: string }) => entry.entityId === legacyId),
      );
    const row = res[0];
    expect(row).toMatchObject({ entity: 'news', targetLabel: null });
    expect(row.entityId).toBe(legacyId);
  });

  it('refuses a cover the administrator does not own', async () => {
    const res = await t.request({
      method: 'POST',
      url: '/admin/news',
      auth: admin.auth,
      body: body({ coverMediaId: '00000000-0000-4000-8000-000000000000' }),
    });
    expect(res.status).toBe(422);
  });
});
