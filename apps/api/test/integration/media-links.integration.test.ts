import { createHash } from 'node:crypto';
import {
  AppUser,
  Household,
  JournalEntry,
  MediaAsset,
  type MediaCredit,
  MediaLink,
  type MediaLinkRole,
  type MediaLinkTarget,
  News,
  Product,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const CREDIT: MediaCredit = {
  title: 'File:Gom.jpg',
  author: 'Tác giả ảnh',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gom.jpg',
};

const sha256Of = (name: string) => createHash('sha256').update(name).digest('hex');

/**
 * GH#54 — API công khai đọc ảnh và ghi công từ `media_link` / `media_asset` trên CSDL thật: thứ tự theo
 * `position`, ưu tiên mô tả của liên kết, không bao giờ lộ giấy tờ, tệp riêng tư hay tệp chưa xử lý xong.
 */
describe('Public images from media_link', () => {
  let db: TestDatabase;
  let t: TestApp;
  let repAuth: string;
  let ownMediaId: string;

  const ownerId = crypto.randomUUID();

  async function asset(
    name: string,
    fields: Partial<Pick<MediaAsset, 'status' | 'visibility' | 'credit' | 'altText'>> = {},
  ) {
    const em = db.orm.em.fork();
    const created = em.create(MediaAsset, {
      ownerId,
      purpose: 'PRODUCT',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 1,
      sha256: sha256Of(name),
      originalKey: `originals/${name}`,
      variants: [
        { format: 'webp', width: 320, height: 200, key: `v/${name}-320.webp`, bytes: 1 },
        { format: 'webp', width: 1280, height: 800, key: `v/${name}-1280.webp`, bytes: 1 },
        { format: 'avif', width: 1280, height: 800, key: `v/${name}-1280.avif`, bytes: 1 },
      ],
      credit: CREDIT,
      altText: `Mô tả mặc định ${name}`,
      ...fields,
    });
    await em.flush();
    return created.id;
  }

  async function link(
    media: string,
    targetType: MediaLinkTarget,
    targetId: string,
    role: MediaLinkRole,
    position = 0,
    fields: { altText?: string; caption?: string } = {},
  ) {
    const em = db.orm.em.fork();
    em.create(MediaLink, {
      media: em.getReference(MediaAsset, media),
      targetType,
      targetId,
      role,
      position,
      ...fields,
    });
    await em.flush();
  }

  const urlOf = (name: string) => t.storage.publicUrl(`v/${name}-1280.webp`);

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);

    const em = db.orm.em.fork();
    const rep = em.create(AppUser, {
      id: ownerId,
      email: 'gom-anh@test.local',
      role: 'HOUSEHOLD',
    });
    repAuth = `Bearer test:${ownerId}`;
    const household = em.create(Household, {
      name: 'Gốm Ảnh',
      slug: 'gom-anh',
      history: 'Lịch sử mẫu.',
      status: 'APPROVED',
      representative: rep,
    });
    const product = em.create(Product, {
      household,
      name: 'Bình có ảnh',
      slug: 'binh-co-anh',
      traceCode: 'BT7K2QXA',
      description: 'Mô tả.',
      kind: 'OBJECT',
      category: 'DECOR',
      priceVnd: 100_000,
      stock: 1,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-01T00:00:00.000Z'),
      coverUrl: 'https://cdn.test/bia.webp',
      coverAlt: 'Bìa',
    });
    em.create(JournalEntry, {
      product,
      seq: 0,
      stage: 'clay',
      declaredDate: '2026-09-01',
      note: 'Nhào đất',
      images: [
        { url: 'https://cdn.test/cong-doan.webp', sha256: sha256Of('cong-doan') },
        { url: 'https://cdn.test/tu-chup.webp', sha256: sha256Of('tu-chup') },
      ],
      prevHash: 'GENESIS',
      hash: 'a'.repeat(64),
    });
    const withCover = em.create(News, {
      slug: 'tin-co-anh',
      title: 'Tin có ảnh',
      summary: 'Tóm tắt',
      body: 'Nội dung',
      category: 'VILLAGE_EVENT',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-02T00:00:00.000Z'),
    });
    em.create(News, {
      slug: 'tin-khong-anh',
      title: 'Tin không ảnh',
      summary: 'Tóm tắt',
      body: 'Nội dung',
      category: 'VILLAGE_EVENT',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    await em.flush();

    await link(await asset('chan-dung'), 'HOUSEHOLD', household.id, 'PORTRAIT');
    await link(await asset('bia-ho'), 'HOUSEHOLD', household.id, 'BANNER');
    // Tạo ngược thứ tự để chắc API sắp theo `position`, không theo lúc tạo.
    await link(await asset('thu-vien-2'), 'HOUSEHOLD', household.id, 'GALLERY', 2, {
      altText: 'Mô tả riêng chỗ này',
      caption: 'Chú thích',
    });
    await link(
      await asset('thu-vien-1', { credit: null }),
      'HOUSEHOLD',
      household.id,
      'GALLERY',
      1,
    );
    // Không bao giờ được hiện ra công khai.
    await link(
      await asset('giay-to', { visibility: 'PRIVATE' }),
      'HOUSEHOLD',
      household.id,
      'DOCUMENT',
    );
    await link(await asset('giay-to-lo', {}), 'HOUSEHOLD', household.id, 'DOCUMENT', 1);
    await link(
      await asset('dang-xu-ly', { status: 'PROCESSING' }),
      'HOUSEHOLD',
      household.id,
      'GALLERY',
      3,
    );
    await link(
      await asset('rieng-tu', { visibility: 'PRIVATE' }),
      'HOUSEHOLD',
      household.id,
      'GALLERY',
      4,
    );

    await link(await asset('bia-sp'), 'PRODUCT', product.id, 'COVER');
    await link(await asset('bia-tin'), 'NEWS', withCover.id, 'COVER');
    await asset('cong-doan');
    await asset('tu-chup', { credit: null });

    ownMediaId = await asset('anh-cua-ho', { credit: null });
    const own = db.orm.em.fork();
    const target = await own.findOneOrFail(Household, household.id);
    target.gallery = [{ mediaId: ownMediaId, alt: 'Ảnh hộ tự gắn' }];
    await own.flush();
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('hồ sơ hộ trả ảnh thẻ, ảnh bìa và thư viện theo `position`, kèm mô tả và ghi công', async () => {
    const res = await t.request({ method: 'GET', url: '/households/gom-anh' });
    expect(res.status).toBe(200);
    expect(res.body.portrait).toMatchObject({
      url: urlOf('chan-dung'),
      alt: 'Mô tả mặc định chan-dung',
      credit: CREDIT,
    });
    expect(res.body.banner).toMatchObject({ url: urlOf('bia-ho'), credit: CREDIT });
    expect(res.body.gallery).toEqual([
      {
        mediaId: expect.any(String),
        url: urlOf('thu-vien-1'),
        alt: 'Mô tả mặc định thu-vien-1',
        caption: null,
        credit: null,
      },
      {
        mediaId: expect.any(String),
        url: urlOf('thu-vien-2'),
        alt: 'Mô tả riêng chỗ này',
        caption: 'Chú thích',
        credit: CREDIT,
      },
      {
        mediaId: ownMediaId,
        url: urlOf('anh-cua-ho'),
        alt: 'Ảnh hộ tự gắn',
        caption: null,
        credit: null,
      },
    ]);
  });

  it('giấy tờ, tệp riêng tư và tệp chưa xử lý xong không lọt ra hồ sơ công khai', async () => {
    const res = await t.request({ method: 'GET', url: '/households/gom-anh' });
    const raw = JSON.stringify(res.body);
    for (const name of ['giay-to', 'giay-to-lo', 'dang-xu-ly', 'rieng-tu']) {
      expect(raw, name).not.toContain(`v/${name}-`);
    }
  });

  it('hồ sơ riêng chỉ có ảnh hộ tự gắn, nên gửi lại thư viện không vướng ảnh của Ban quản lý', async () => {
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: repAuth });
    expect(mine.status).toBe(200);
    expect(mine.body.gallery.map((item: { mediaId: string }) => item.mediaId)).toEqual([
      ownMediaId,
    ]);
    const saved = await t.request({
      method: 'PATCH',
      url: '/me/household',
      auth: repAuth,
      headers: { 'if-match': `"${mine.body.version}"` },
      body: {
        gallery: mine.body.gallery.map((item: { mediaId: string; alt: string }) => ({
          mediaId: item.mediaId,
          alt: item.alt,
        })),
      },
    });
    expect(saved.status).toBe(200);
  });

  it('danh sách và chi tiết tin trả ảnh bìa; tin chưa gắn ảnh thì trống', async () => {
    const list = await t.request({ method: 'GET', url: '/news' });
    expect(list.status).toBe(200);
    const bySlug = new Map(
      list.body.data.map((n: { slug: string; cover: unknown }) => [n.slug, n.cover]),
    );
    expect(bySlug.get('tin-co-anh')).toMatchObject({
      url: urlOf('bia-tin'),
      alt: 'Mô tả mặc định bia-tin',
      credit: CREDIT,
    });
    expect(bySlug.get('tin-khong-anh')).toBeNull();

    const detail = await t.request({ method: 'GET', url: '/news/tin-co-anh' });
    expect(detail.body.cover).toMatchObject({ url: urlOf('bia-tin'), credit: CREDIT });
    const empty = await t.request({ method: 'GET', url: '/news/tin-khong-anh' });
    expect(empty.body.cover).toBeNull();
  });

  it('truy xuất và chi tiết sản phẩm trả ảnh công đoạn kèm ghi công, ảnh tự chụp thì trống', async () => {
    const trace = await t.request({ method: 'GET', url: '/trace/BT7K2QXA' });
    expect(trace.status).toBe(200);
    expect(trace.body.coverCredit).toEqual(CREDIT);
    expect(trace.body.journal.entries[0].images).toEqual([
      {
        url: 'https://cdn.test/cong-doan.webp',
        sha256: sha256Of('cong-doan'),
        credit: CREDIT,
      },
      { url: 'https://cdn.test/tu-chup.webp', sha256: sha256Of('tu-chup'), credit: null },
    ]);

    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.status).toBe(200);
    expect(detail.body.coverCredit).toEqual(CREDIT);
    expect(detail.body.journal.entries[0].images[0].credit).toEqual(CREDIT);
  });

  it('hộ thay bìa bằng ảnh tự tải lên thì không còn ghi công của bìa cũ', async () => {
    const em = db.orm.em.fork();
    const product = await em.findOneOrFail(Product, { slug: 'binh-co-anh' });
    product.coverUrl = null;
    await em.flush();
    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.body.coverCredit).toBeNull();
  });
});
