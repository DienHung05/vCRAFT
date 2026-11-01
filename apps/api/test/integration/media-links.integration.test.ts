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
 * GH#54 — the public API reads images and credits from `media_link` / `media_asset` on a real database:
 * ordered by `position`, preferring the link's alt text, never exposing documents, private or unprocessed files.
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
      width: 1280,
      height: 800,
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
  /** What `asset()` stores, as the public API lists it: narrowest first, AVIF before WebP at one width. */
  const variantsOf = (name: string) => [
    { format: 'webp', width: 320, height: 200, url: t.storage.publicUrl(`v/${name}-320.webp`) },
    { format: 'avif', width: 1280, height: 800, url: t.storage.publicUrl(`v/${name}-1280.avif`) },
    { format: 'webp', width: 1280, height: 800, url: t.storage.publicUrl(`v/${name}-1280.webp`) },
  ];

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
    // Created out of order to prove the API sorts by `position`, not by creation time.
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
    // Must never appear publicly.
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

  it('household profile returns portrait, banner and gallery by `position`, with alt text and credit', async () => {
    const res = await t.request({ method: 'GET', url: '/households/gom-anh' });
    expect(res.status).toBe(200);
    expect(res.body.portrait).toMatchObject({
      url: urlOf('chan-dung'),
      width: 1280,
      height: 800,
      variants: variantsOf('chan-dung'),
      alt: 'Mô tả mặc định chan-dung',
      credit: CREDIT,
    });
    expect(res.body.banner).toMatchObject({ url: urlOf('bia-ho'), credit: CREDIT });
    expect(res.body.gallery).toEqual([
      {
        mediaId: expect.any(String),
        url: urlOf('thu-vien-1'),
        variants: variantsOf('thu-vien-1'),
        alt: 'Mô tả mặc định thu-vien-1',
        caption: null,
        credit: null,
      },
      {
        mediaId: expect.any(String),
        url: urlOf('thu-vien-2'),
        variants: variantsOf('thu-vien-2'),
        alt: 'Mô tả riêng chỗ này',
        caption: 'Chú thích',
        credit: CREDIT,
      },
      {
        mediaId: ownMediaId,
        url: urlOf('anh-cua-ho'),
        variants: variantsOf('anh-cua-ho'),
        alt: 'Ảnh hộ tự gắn',
        caption: null,
        credit: null,
      },
    ]);
  });

  it('documents, private and unprocessed files stay out of the public profile', async () => {
    const res = await t.request({ method: 'GET', url: '/households/gom-anh' });
    const raw = JSON.stringify(res.body);
    for (const name of ['giay-to', 'giay-to-lo', 'dang-xu-ly', 'rieng-tu']) {
      expect(raw, name).not.toContain(`v/${name}-`);
    }
  });

  it('private profile has only the household images, so saving the gallery is not blocked by admin media', async () => {
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

  it('news list and detail return the cover; news without one returns null', async () => {
    const list = await t.request({ method: 'GET', url: '/news' });
    expect(list.status).toBe(200);
    const bySlug = new Map(
      list.body.data.map((n: { slug: string; cover: unknown }) => [n.slug, n.cover]),
    );
    expect(bySlug.get('tin-co-anh')).toMatchObject({
      url: urlOf('bia-tin'),
      variants: variantsOf('bia-tin'),
      alt: 'Mô tả mặc định bia-tin',
      credit: CREDIT,
    });
    expect(bySlug.get('tin-khong-anh')).toBeNull();

    const detail = await t.request({ method: 'GET', url: '/news/tin-co-anh' });
    expect(detail.body.cover).toMatchObject({ url: urlOf('bia-tin'), credit: CREDIT });
    const empty = await t.request({ method: 'GET', url: '/news/tin-khong-anh' });
    expect(empty.body.cover).toBeNull();
  });

  it('trace and product detail return stage photos with credit; own photos have none', async () => {
    const trace = await t.request({ method: 'GET', url: '/trace/BT7K2QXA' });
    expect(trace.status).toBe(200);
    expect(trace.body.coverCredit).toEqual(CREDIT);
    expect(trace.body.journal.entries[0].images).toEqual([
      {
        url: 'https://cdn.test/cong-doan.webp',
        sha256: sha256Of('cong-doan'),
        credit: CREDIT,
        variants: variantsOf('cong-doan'),
      },
      {
        url: 'https://cdn.test/tu-chup.webp',
        sha256: sha256Of('tu-chup'),
        credit: null,
        variants: variantsOf('tu-chup'),
      },
    ]);

    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.status).toBe(200);
    expect(detail.body.coverCredit).toEqual(CREDIT);
    expect(detail.body.journal.entries[0].images[0].credit).toEqual(CREDIT);
  });

  it('replacing the cover with an uploaded photo drops the old cover credit', async () => {
    const em = db.orm.em.fork();
    const product = await em.findOneOrFail(Product, { slug: 'binh-co-anh' });
    product.coverUrl = null;
    await em.flush();
    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.body.coverCredit).toBeNull();
  });

  it('uploaded product photos and the catalog and household lists carry their sizes', async () => {
    const photo = await asset('anh-san-pham', { credit: null });
    const em = db.orm.em.fork();
    const product = await em.findOneOrFail(Product, { slug: 'binh-co-anh' });
    product.coverUrl = null;
    product.images = [{ mediaId: photo, alt: 'Bình trên bàn gỗ' }];
    const household = await em.findOneOrFail(Household, { slug: 'gom-anh' });
    household.coverUrl = urlOf('bia-ho');
    await em.flush();

    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.body.product.coverUrl).toBe(urlOf('anh-san-pham'));
    expect(detail.body.product.coverVariants).toEqual(variantsOf('anh-san-pham'));
    expect(detail.body.product.images).toEqual([
      {
        mediaId: photo,
        url: urlOf('anh-san-pham'),
        variants: variantsOf('anh-san-pham'),
        alt: 'Bình trên bàn gỗ',
      },
    ]);

    const list = await t.request({ method: 'GET', url: '/products' });
    const card = list.body.data.find((p: { slug: string }) => p.slug === 'binh-co-anh');
    expect(card.coverVariants).toEqual(variantsOf('anh-san-pham'));

    const households = await t.request({ method: 'GET', url: '/households' });
    const summary = households.body.data.find((h: { slug: string }) => h.slug === 'gom-anh');
    expect(summary.coverUrl).toBe(urlOf('bia-ho'));
    expect(summary.coverVariants).toEqual(variantsOf('bia-ho'));

    const profile = await t.request({ method: 'GET', url: '/households/gom-anh' });
    expect(profile.body.coverVariants).toEqual(variantsOf('bia-ho'));
  });

  it('a preset cover URL has no variants', async () => {
    const em = db.orm.em.fork();
    const product = await em.findOneOrFail(Product, { slug: 'binh-co-anh' });
    product.coverUrl = '/images/demo/am-men-ngoc-ly-1280.webp';
    await em.flush();
    const detail = await t.request({ method: 'GET', url: '/products/binh-co-anh' });
    expect(detail.body.product.coverUrl).toBe('/images/demo/am-men-ngoc-ly-1280.webp');
    expect(detail.body.product.coverVariants).toEqual([]);
  });
});
