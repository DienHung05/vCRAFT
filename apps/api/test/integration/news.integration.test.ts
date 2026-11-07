import { AppUser, Household, News } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * vCRAFT-83g — tin tức công khai qua HTTP trên CSDL thật: thứ tự (ghim trước, mới nhất trước),
 * phân trang con trỏ, lọc theo hộ, ẩn bản nháp, ẩn tin của hộ tạm ngừng, 404 ở trang chi tiết.
 */
describe('Public news', () => {
  let db: TestDatabase;
  let t: TestApp;
  const day = (n: number) => new Date(Date.UTC(2026, 9, n, 3, 0, 0));

  async function household(slug: string, status: 'APPROVED' | 'PENDING_REVIEW' | 'SUSPENDED') {
    const em = db.orm.em.fork();
    const rep = em.create(AppUser, {
      id: crypto.randomUUID(),
      email: `${slug}@test.local`,
      role: 'HOUSEHOLD',
    });
    const created = em.create(Household, {
      name: `Hộ ${slug}`,
      slug,
      history: 'Lịch sử mẫu.',
      status,
      representative: rep,
    });
    await em.flush();
    return created.id;
  }

  async function news(
    slug: string,
    fields: {
      householdId?: string;
      publishedAt?: Date | null;
      pinned?: boolean;
      status?: 'DRAFT' | 'PUBLISHED';
      category?: 'HOUSEHOLD_UPDATE' | 'VILLAGE_EVENT' | 'CRAFT_STORY';
    } = {},
  ) {
    const em = db.orm.em.fork();
    em.create(News, {
      slug,
      title: `Tiêu đề ${slug}`,
      summary: `Tóm tắt ${slug}`,
      body: `Nội dung ${slug}`,
      category: fields.category ?? 'VILLAGE_EVENT',
      household: fields.householdId ? em.getReference(Household, fields.householdId) : null,
      status: fields.status ?? 'PUBLISHED',
      publishedAt: fields.publishedAt === undefined ? day(10) : fields.publishedAt,
      pinned: fields.pinned ?? false,
    });
    await em.flush();
  }

  const slugsOf = (body: { data: { slug: string }[] }) => body.data.map((n) => n.slug);

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);

    const approved = await household('gom-a', 'APPROVED');
    const other = await household('gom-b', 'APPROVED');
    const suspended = await household('gom-treo', 'SUSPENDED');
    const pending = await household('gom-cho', 'PENDING_REVIEW');

    await news('ghim-cu', { publishedAt: day(1), pinned: true });
    await news('lang-moi', { publishedAt: day(20) });
    await news('lang-cu', { publishedAt: day(5), category: 'CRAFT_STORY' });
    await news('a-moi', {
      householdId: approved,
      publishedAt: day(15),
      category: 'HOUSEHOLD_UPDATE',
    });
    await news('a-cu', {
      householdId: approved,
      publishedAt: day(3),
      category: 'HOUSEHOLD_UPDATE',
    });
    await news('b-moi', { householdId: other, publishedAt: day(12) });
    // Hai tin cùng thời điểm xuất bản: thứ tự phụ theo id giảm dần, vẫn phải ổn định khi phân trang
    await news('cung-gio-1', { publishedAt: day(8) });
    await news('cung-gio-2', { publishedAt: day(8) });
    // Phải ẩn
    await news('ban-nhap', { status: 'DRAFT', publishedAt: null });
    await news('ban-nhap-ghim', { status: 'DRAFT', publishedAt: null, pinned: true });
    await news('hanh-treo', { householdId: suspended, publishedAt: day(25) });
    await news('hanh-cho', { householdId: pending, publishedAt: day(26) });
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('không cần đăng nhập; ghim trước rồi mới nhất trước; ẩn nháp và tin của hộ không còn công khai', async () => {
    const res = await t.request({ method: 'GET', url: '/news' });
    expect(res.status).toBe(200);
    const slugs = slugsOf(res.body);
    expect(slugs[0]).toBe('ghim-cu');
    expect(slugs.filter((s) => s !== 'cung-gio-1' && s !== 'cung-gio-2')).toEqual([
      'ghim-cu',
      'lang-moi',
      'a-moi',
      'b-moi',
      'lang-cu',
      'a-cu',
    ]);
    expect(slugs).not.toContain('ban-nhap');
    expect(slugs).not.toContain('ban-nhap-ghim');
    expect(slugs).not.toContain('hanh-treo');
    expect(slugs).not.toContain('hanh-cho');
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.data[0]).toMatchObject({
      pinned: true,
      householdName: null,
      householdSlug: null,
    });
    expect(res.body.data[0].body).toBeUndefined();
    const withHousehold = res.body.data.find((n: { slug: string }) => n.slug === 'a-moi');
    expect(withHousehold).toMatchObject({ householdName: 'Hộ gom-a', householdSlug: 'gom-a' });
  });

  it('gắn Cache-Control công khai và ETag, trả 304 khi If-None-Match khớp', async () => {
    const first = await t.app.inject({ method: 'GET', url: '/api/v1/news' });
    expect(first.statusCode).toBe(200);
    expect(first.headers['cache-control']).toMatch(/^public,/);
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\/"/);
    const second = await t.app.inject({
      method: 'GET',
      url: '/api/v1/news',
      headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
  });

  it('phân trang con trỏ đi hết danh sách, không trùng, không sót, kể cả khi cùng thời điểm', async () => {
    const all = slugsOf((await t.request({ method: 'GET', url: '/news?limit=100' })).body);
    expect(all).toHaveLength(8);
    for (const limit of [1, 2, 3]) {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const url: string = `/news?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
        const res = await t.request({ method: 'GET', url });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeLessThanOrEqual(limit);
        seen.push(...slugsOf(res.body));
        cursor = res.body.nextCursor;
        pages++;
      } while (cursor && pages < 20);
      expect(seen, `limit=${limit}`).toEqual(all);
    }
  });

  it('numbered pages (GH#202): totals, same order as the cursor walk, last page past the end', async () => {
    const all = slugsOf((await t.request({ method: 'GET', url: '/news?limit=100' })).body);
    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await t.request({ method: 'GET', url: `/news?page=${page}&limit=3` });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        page,
        pageSize: 3,
        total: 8,
        totalPages: 3,
        nextCursor: null,
      });
      seen.push(...slugsOf(res.body));
    }
    expect(seen).toEqual(all);
    const far = await t.request({ method: 'GET', url: '/news?page=99&limit=3' });
    expect(far.body.page).toBe(3);
    expect(slugsOf(far.body)).toEqual(all.slice(6));
    const both = await t.request({ method: 'GET', url: '/news?page=1&cursor=abc' });
    expect(both.status).toBeGreaterThanOrEqual(400);
    expect(both.status).toBeLessThan(500);
  });

  it('cursor sai là 400, limit ngoài khoảng là 422', async () => {
    const bad = await t.request({ method: 'GET', url: '/news?cursor=khong-hop-le' });
    expect(bad.status).toBe(400);
    const limit = await t.request({ method: 'GET', url: '/news?limit=0' });
    expect(limit.status).toBe(422);
  });

  it('lọc theo hộ và theo loại', async () => {
    const mine = await t.request({ method: 'GET', url: '/news?householdSlug=gom-a' });
    expect(slugsOf(mine.body)).toEqual(['a-moi', 'a-cu']);
    const none = await t.request({ method: 'GET', url: '/news?householdSlug=khong-co' });
    expect(none.status).toBe(200);
    expect(none.body.data).toEqual([]);
    const suspended = await t.request({ method: 'GET', url: '/news?householdSlug=gom-treo' });
    expect(suspended.body.data).toEqual([]);
    const stories = await t.request({ method: 'GET', url: '/news?category=CRAFT_STORY' });
    expect(slugsOf(stories.body)).toEqual(['lang-cu']);
  });

  it('chi tiết trả đủ nội dung; nháp, hộ tạm ngừng, hộ chờ duyệt và slug lạ đều 404', async () => {
    const ok = await t.request({ method: 'GET', url: '/news/a-moi' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      slug: 'a-moi',
      title: 'Tiêu đề a-moi',
      body: 'Nội dung a-moi',
      category: 'HOUSEHOLD_UPDATE',
      householdSlug: 'gom-a',
    });
    for (const slug of ['ban-nhap', 'hanh-treo', 'hanh-cho', 'khong-ton-tai']) {
      const res = await t.request({ method: 'GET', url: `/news/${slug}` });
      expect(res.status, slug).toBe(404);
    }
  });

  it('hộ bị tạm ngừng ẩn tin ngay, khôi phục thì tin hiện lại', async () => {
    const em = db.orm.em.fork();
    const target = await em.findOneOrFail(Household, { slug: 'gom-a' });
    target.status = 'SUSPENDED';
    await em.flush();
    const hidden = await t.request({ method: 'GET', url: '/news' });
    expect(slugsOf(hidden.body)).not.toContain('a-moi');
    expect((await t.request({ method: 'GET', url: '/news/a-moi' })).status).toBe(404);

    target.status = 'APPROVED';
    await em.flush();
    expect(slugsOf((await t.request({ method: 'GET', url: '/news' })).body)).toContain('a-moi');
  });
});
