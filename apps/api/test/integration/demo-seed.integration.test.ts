import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AppUser,
  CooperativeQuotation,
  clearBusinessData,
  DEMO_ACCOUNTS,
  DEMO_HOUSEHOLD_IDS,
  DEMO_PHOTOS,
  DEMO_QR_TRACE_CODE,
  DEMO_REQUEST_IDS,
  DEMO_VERIFICATION_DOCS,
  demoDocumentAssetId,
  demoPhotoAssetId,
  FIELD_CONTEXTS,
  FieldCipher,
  Household,
  JournalEntry,
  linkDemoMedia,
  MediaAsset,
  MediaLink,
  News,
  OrderAllocation,
  Product,
  QuotationRequest,
  RETIRED_DEMO_PHOTO_IDS,
  seedDemoData,
  verifyDemoData,
} from '@vcraft/database';
import { type ChainEntry, verifyChain } from '@vcraft/domain';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  pruneRetiredDemoMedia,
  publishDemoMedia,
} from '../../../worker/src/demo/publish-demo-media.js';
import { startTestApp, TEST_FIELD_KEYS, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/**
 * GH#14 — dữ liệu mẫu demo: khối lượng đúng cam kết, chuỗi băm nhật ký hợp lệ, reset hai lần cho cùng kết quả,
 * và (quan trọng nhất) dữ liệu chạy được qua API thật theo kịch bản demo với bốn tài khoản cố định.
 */
describe('Demo seed and guarded reset', () => {
  let db: TestDatabase;
  let t: TestApp;
  const now = new Date('2026-12-20T02:00:00.000Z');
  const as = (key: keyof typeof DEMO_ACCOUNTS) => `Bearer test:${DEMO_ACCOUNTS[key].id}`;

  const snapshot = async () => {
    const em = db.orm.em.fork();
    return {
      users: await em.count(AppUser),
      households: await em.count(Household),
      products: await em.count(Product),
      journal: await em.count(JournalEntry),
      requests: await em.count(QuotationRequest),
      allocations: await em.count(OrderAllocation),
      news: await em.count(News),
      ids: (await em.find(Product, {}, { orderBy: { id: 'asc' } })).map(
        (p) => `${p.id}:${p.traceCode}`,
      ),
    };
  };

  const reset = async () => {
    const em = db.orm.em.fork();
    await em.transactional(async (tx) => {
      await clearBusinessData(tx);
      await seedDemoData(tx, { now, cipher: new FieldCipher(TEST_FIELD_KEYS) });
    });
  };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    await reset();
    t = await startTestApp(db);
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('có đủ khối lượng cam kết và bốn tài khoản cố định đúng vai trò', async () => {
    const em = db.orm.em.fork();
    expect(await em.count(Household)).toBeGreaterThanOrEqual(20);
    expect(await em.count(Household, { status: 'PENDING_REVIEW' })).toBe(1);
    expect(await em.count(Household, { status: 'APPROVED' })).toBeGreaterThanOrEqual(20);
    expect(await em.count(Product)).toBeGreaterThanOrEqual(200);
    expect(await em.count(QuotationRequest)).toBe(12);
    expect(await em.count(News, { status: 'PUBLISHED' })).toBeGreaterThanOrEqual(15);
    const statuses = new Set((await em.find(QuotationRequest, {})).map((r) => r.status));
    expect(statuses).toEqual(
      new Set([
        'DRAFT',
        'SENT',
        'BIDDING',
        'ACCEPTED',
        'IN_PRODUCTION',
        'DELIVERED',
        'CANCELLED',
        'EXPIRED',
      ]),
    );

    for (const account of Object.values(DEMO_ACCOUNTS)) {
      const user = await em.findOneOrFail(AppUser, account.id);
      expect(user).toMatchObject({ email: account.email, role: account.role, status: 'ACTIVE' });
    }
    const pending = await em.findOneOrFail(Household, DEMO_HOUSEHOLD_IDS.pending, {
      populate: ['representative'],
    });
    expect(pending.status).toBe('PENDING_REVIEW');
    expect(pending.representative.id).toBe(DEMO_ACCOUNTS.pending.id);
    const own = await em.findOneOrFail(Household, DEMO_HOUSEHOLD_IDS.household, {
      populate: ['representative'],
    });
    expect(own.representative.id).toBe(DEMO_ACCOUNTS.household.id);
  });

  it('every sample household has an obviously fake citizen ID number, stored encrypted', async () => {
    const cipher = new FieldCipher(TEST_FIELD_KEYS);
    const households = await db.orm.em.fork().find(Household, {});
    expect(households.length).toBeGreaterThan(0);
    for (const household of households) {
      const stored = household.idNumberEnc as string;
      expect(stored).toMatch(/^v1:/);
      const plain = cipher.decrypt(stored, FIELD_CONTEXTS.householdIdNumber);
      expect(plain).toMatch(/^00000000\d{4}$/);
      expect(stored).not.toContain(plain);
    }
    // The review screen for a demo household shows the masked fake number and can reveal it.
    const admin = await t.request({
      method: 'GET',
      url: `/admin/households/${DEMO_HOUSEHOLD_IDS.household}`,
      auth: `Bearer test:${DEMO_ACCOUNTS.admin.id}`,
    });
    expect(admin.body.idNumberMasked).toMatch(/^••••••••\d{4}$/);
  });

  it('bộ kiểm tra `demo:verify` báo dữ liệu còn nguyên ngay sau khi nạp', async () => {
    const report = await verifyDemoData(db.orm.em.fork(), now, { media: false });
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('chưa chạy `demo:media` thì nhóm kiểm ảnh và giấy tờ báo đỏ', async () => {
    const report = await verifyDemoData(db.orm.em.fork(), now);
    const failed = report.checks.filter((c) => !c.ok).map((c) => c.name);
    expect(report.ok).toBe(false);
    expect(failed.some((name) => name.startsWith('Ảnh minh hoạ'))).toBe(true);
    expect(failed.some((name) => name.startsWith('Hộ chờ duyệt: 3 giấy tờ'))).toBe(true);
  });

  it('ảnh có giấy phép và giấy tờ mẫu: tải lên, gắn vào seed, verify xanh, chạy lại được sau reset', async () => {
    // CI chậm: dùng bản thu nhỏ 160px của đúng các tệp ảnh trong bảng ánh xạ (cùng tên, cùng đường xử lý ảnh) để bước mã hóa AVIF/WebP không
    // chiếm thời gian; ảnh thật đầy đủ được kiểm bằng `demo:verify` trên project Supabase.
    const realImagesDir = fileURLToPath(
      new URL('../../../web/public/images/demo', import.meta.url),
    );
    const imagesDir = await mkdtemp(join(tmpdir(), 'vcraft-demo-photos-'));
    for (const photo of DEMO_PHOTOS) {
      const name = `${photo.id}-${Math.max(...photo.widths)}.webp`;
      const small = await sharp(join(realImagesDir, name)).resize({ width: 160 }).webp().toBuffer();
      await writeFile(join(imagesDir, name), small);
    }
    const specimenDir = fileURLToPath(
      new URL('../../../../scripts/demo-photos/specimen-docs', import.meta.url),
    );
    const publish = async () => {
      const uploaded = await publishDemoMedia({
        orm: db.orm,
        storage: t.storage,
        imagesDir,
        specimenDir,
      });
      const linked = await linkDemoMedia(db.orm.em.fork(), {
        publicUrl: (key) => t.storage.publicUrl(key),
      });
      return { uploaded, linked };
    };

    const first = await publish();
    expect(first.uploaded.documentsUploaded).toBe(DEMO_VERIFICATION_DOCS.length);
    // A fresh seed never carried stage photos on journal entries, so nothing needs re-sealing.
    expect(first.linked.journalEntriesChanged).toBe(0);
    expect(first.linked.linksCreated).toBe(first.linked.links);
    const report = await verifyDemoData(db.orm.em.fork(), now);
    expect(report.checks.filter((c) => !c.ok)).toEqual([]);

    // Chạy lại không đổi gì (cùng id, cùng liên kết, cùng dấu băm).
    const hashesBefore = (await db.orm.em.fork().find(JournalEntry, {})).map((e) => e.hash).sort();
    const again = await publish();
    expect(again.uploaded.photosUploaded).toBe(0);
    expect(again.uploaded.photosMetadataUpdated).toBe(0);
    expect(again.linked.changes).toBe(0);
    const hashesAfter = (await db.orm.em.fork().find(JournalEntry, {})).map((e) => e.hash).sort();
    expect(hashesAfter).toEqual(hashesBefore);
    expect(await db.orm.em.fork().count(MediaLink)).toBe(first.linked.links);

    // Giấy tờ chỉ ở bucket riêng tư: Admin đọc qua URL ký, Buyer bị từ chối, không có biến thể công khai.
    const docId = demoDocumentAssetId(DEMO_VERIFICATION_DOCS[0]?.id as string);
    const doc = await db.orm.em.fork().findOneOrFail(MediaAsset, docId);
    expect(doc).toMatchObject({ purpose: 'CERTIFICATE', visibility: 'PRIVATE', status: 'READY' });
    expect(doc.variants).toEqual([]);
    const adminRead = await t.request({
      method: 'GET',
      url: `/media/${docId}/read-url`,
      auth: as('admin'),
    });
    expect(adminRead.status).toBe(200);
    const buyerRead = await t.request({
      method: 'GET',
      url: `/media/${docId}/read-url`,
      auth: as('buyer'),
    });
    expect([403, 404]).toContain(buyerRead.status);

    // Ảnh bìa mà API công khai trả (`coverUrl`) đã trỏ về bucket, không còn đường dẫn tĩnh của web.
    // Chỉ chiếc bình có ảnh đúng món đồ; chiếc cốc QR (ảnh gốc là cốc New Zealand) dùng hình minh hoạ.
    const vase = await db.orm.em.fork().findOneOrFail(Product, { traceCode: 'BT7K2QXM' });
    expect(vase.coverUrl).toMatch(/^http:\/\/localhost:8080\/media\/v\/.+\.webp$/);
    expect(vase.coverAlt).toBeTruthy();
    expect(vase.coverAltEn).toMatch(/^[\x20-\x7e]+$/);
    const cup = await db.orm.em.fork().findOneOrFail(Product, { traceCode: DEMO_QR_TRACE_CODE });
    expect(cup.coverUrl).toBeNull();
    expect(cup.coverAlt).toBeNull();
    const minhHai = await db.orm.em.fork().findOneOrFail(Household, { slug: 'gom-minh-hai' });
    expect(minhHai.coverUrl).toMatch(/^http:\/\/localhost:8080\/media\/v\//);

    // The public trace page has no photo for the cup and no stage photo on any entry: a generic stage photo is not
    // this cup. The chain still verifies (checked below for every product).
    const trace = await t.request({ method: 'GET', url: `/trace/${DEMO_QR_TRACE_CODE}` });
    expect(trace.status).toBe(200);
    expect(trace.body.coverCredit).toBeNull();
    expect(trace.body.journal.entries.length).toBeGreaterThan(0);
    for (const entry of trace.body.journal.entries) expect(entry.images).toEqual([]);
    const vaseTrace = await t.request({ method: 'GET', url: '/trace/BT7K2QXM' });
    expect(vaseTrace.body.coverCredit.author).toBeTruthy();

    // Public household profiles and news read real images and credits from `media_link` (GH#54).
    const profile = await t.request({ method: 'GET', url: '/households/gom-minh-hai' });
    expect(profile.body.portrait.credit.author).toBeTruthy();
    expect(profile.body.banner.url).toBe(minhHai.coverUrl);
    expect(profile.body.gallery.length).toBeGreaterThan(0);
    expect(profile.body.banner.altEn).toMatch(/^[\x20-\x7e]+$/);
    expect(profile.body.portrait.altEn).toMatch(/^[\x20-\x7e]+$/);
    for (const item of profile.body.gallery) {
      expect(item.url).toMatch(/^http:\/\/localhost:8080\/media\/v\//);
      expect(item.alt).toBeTruthy();
      expect(item.altEn).toMatch(/^[\x20-\x7e]+$/);
      expect(item.credit.licenseUrl).toMatch(/^https:\/\//);
    }
    const allNews = await t.request({ method: 'GET', url: '/news?limit=100' });
    const covers = allNews.body.data.flatMap((n: { cover: { credit: unknown } | null }) =>
      n.cover ? [n.cover] : [],
    );
    // The night-market story has no photo that shows a night market, so only two stories keep a cover.
    expect(covers).toHaveLength(2);
    expect(covers.every((c: { altEn: string | null }) => c.altEn)).toBe(true);

    // The household list gives each cover its own description (vi and en), not a template.
    const households = await t.request({ method: 'GET', url: '/households' });
    const listed = households.body.data.find((h: { slug: string }) => h.slug === 'gom-minh-hai');
    expect(listed.coverAlt).toBeTruthy();
    expect(listed.coverAltEn).toMatch(/^[\x20-\x7e]+$/);

    // Admin sees what each verification document is, not just its MIME type.
    const docs = await t.request({
      method: 'GET',
      url: `/admin/households/${DEMO_HOUSEHOLD_IDS.pending}/documents`,
      auth: as('admin'),
    });
    expect(docs.body.data.map((d: { caption: string }) => d.caption).sort()).toEqual(
      DEMO_VERIFICATION_DOCS.map((d) => d.caption).sort(),
    );

    // Retired photos are removed completely (rows, links and stored files) and a second run finds nothing.
    const retired = demoPhotoAssetId(RETIRED_DEMO_PHOTO_IDS[0] as string);
    const key = `originals/${DEMO_ACCOUNTS.admin.id}/${retired}`;
    const em = db.orm.em.fork();
    em.create(MediaAsset, {
      id: retired,
      ownerId: DEMO_ACCOUNTS.admin.id,
      purpose: 'PRODUCT',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 3,
      sha256: 'a'.repeat(64),
      originalKey: key,
      variants: [
        { key: `v/${retired}/640-x.webp`, bytes: 3, width: 640, height: 640, format: 'webp' },
      ],
    });
    await em.flush();
    await t.storage.put({
      bucket: 'private',
      key,
      body: new Uint8Array([1, 2, 3]),
      contentType: 'image/webp',
    });
    const pruned = await pruneRetiredDemoMedia({ orm: db.orm, storage: t.storage });
    expect(pruned).toMatchObject({ assetsDeleted: 1, linksDeleted: 0, failed: [] });
    expect(await db.orm.em.fork().count(MediaAsset, { id: retired })).toBe(0);
    expect((await pruneRetiredDemoMedia({ orm: db.orm, storage: t.storage })).assetsDeleted).toBe(
      0,
    );
    expect(covers.every((c: { credit: unknown }) => c.credit)).toBe(true);

    // Reset xóa media_asset nhưng không động tới bucket; chạy lại bước ảnh dựng lại đúng như cũ.
    await reset();
    expect((await verifyDemoData(db.orm.em.fork(), now)).ok).toBe(false);
    await publish();
    expect((await verifyDemoData(db.orm.em.fork(), now)).ok).toBe(true);
    await rm(imagesDir, { recursive: true, force: true });
  }, 120_000);

  it('mỗi sản phẩm có 4–7 mốc nhật ký và chuỗi băm kiểm được bằng mã miền', async () => {
    const em = db.orm.em.fork();
    const products = await em.find(Product, {});
    expect(products.length).toBeGreaterThanOrEqual(200);
    for (const product of products) {
      const entries = await em.find(
        JournalEntry,
        { product },
        { orderBy: { seq: 'asc' }, populate: ['supersedes'] },
      );
      expect(entries.length, product.traceCode).toBeGreaterThanOrEqual(4);
      expect(entries.length, product.traceCode).toBeLessThanOrEqual(7);
      const chain: ChainEntry[] = entries.map((e) => ({
        seq: e.seq,
        stage: e.stage,
        at: e.declaredDate,
        note: e.note,
        mediaChecksums: e.images.map((image) => image.sha256),
        supersedesSeq: e.supersedes?.seq,
        skipReason: e.skipReason ?? undefined,
        prevHash: e.prevHash,
        hash: e.hash,
      }));
      expect(await verifyChain(product.id, chain), product.traceCode).toEqual({
        ok: true,
        count: entries.length,
      });
    }
  });

  it('tin tức công khai có ≥ 15 tin, tin ghim đứng đầu, gồm cả tin chung và tin của hộ', async () => {
    const list = await t.request({ method: 'GET', url: '/news?limit=100' });
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(15);
    expect(list.body.nextCursor).toBeNull();
    expect(list.body.data[0].pinned).toBe(true);
    expect(
      list.body.data.some((n: { householdSlug: string | null }) => n.householdSlug === null),
    ).toBe(true);
    expect(
      list.body.data.some((n: { householdSlug: string | null }) => n.householdSlug !== null),
    ).toBe(true);
  });

  it('có đúng một đơn IN_PRODUCTION chia cho 4 hộ', async () => {
    const em = db.orm.em.fork();
    const orders = await em.find(QuotationRequest, { status: 'IN_PRODUCTION' });
    expect(orders.map((o) => o.id)).toEqual([DEMO_REQUEST_IDS.inProduction]);
    const accepted = await em.findOneOrFail(CooperativeQuotation, {
      request: orders[0],
      status: 'ACCEPTED',
    });
    const allocations = await em.find(
      OrderAllocation,
      { quotation: accepted },
      { populate: ['household'] },
    );
    expect(new Set(allocations.map((a) => a.household.id)).size).toBe(4);
    expect(allocations.reduce((sum, a) => sum + a.quantity, 0)).toBe(orders[0]?.quantity);
  });

  it('reset hai lần cho cùng số lượng và cùng định danh', async () => {
    const first = await snapshot();
    await reset();
    await reset();
    expect(await snapshot()).toEqual(first);
  });

  it('seed lần hai khi chưa reset bị từ chối (không nhân đôi dữ liệu)', async () => {
    const em = db.orm.em.fork();
    await expect(
      seedDemoData(em, { now, cipher: new FieldCipher(TEST_FIELD_KEYS) }),
    ).rejects.toThrow(/demo:reset/);
  });

  it('kịch bản demo chạy trên API thật: QR → duyệt hộ → xuất bản → chốt giá → xác nhận → tiến độ → nhận hàng', async () => {
    // QR của chiếc cốc thật
    const trace = await t.request({ method: 'GET', url: `/trace/${DEMO_QR_TRACE_CODE}` });
    expect(trace.status).toBe(200);
    expect(trace.body.availability).toBe('VISIBLE');
    expect(trace.body.journal.entries).toHaveLength(7);
    expect(trace.body.journal.inProgress).toBe(false);

    // Admin duyệt hộ chờ duyệt
    const pending = await t.request({
      method: 'GET',
      url: '/admin/households?status=PENDING_REVIEW',
      auth: as('admin'),
    });
    expect(pending.status).toBe(200);
    const target = (pending.body.data ?? pending.body).find(
      (h: { id: string }) => h.id === DEMO_HOUSEHOLD_IDS.pending,
    );
    expect(target).toBeTruthy();
    const approved = await t.request({
      method: 'POST',
      url: `/admin/households/${DEMO_HOUSEHOLD_IDS.pending}/approve`,
      auth: as('admin'),
      headers: { 'if-match': String(target.version) },
    });
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');

    // Hộ household xuất bản một sản phẩm nháp
    const mine = await t.request({ method: 'GET', url: '/me/household', auth: as('household') });
    expect(mine.status).toBe(200);
    const draft = mine.body.products.find((p: { status: string }) => p.status === 'DRAFT');
    expect(draft).toBeTruthy();
    const published = await t.request({
      method: 'POST',
      url: `/products/${draft.id}/publish`,
      auth: as('household'),
      headers: { 'if-match': String(draft.version) },
    });
    expect(published.status).toBe(200);
    expect(published.body.status).toBe('PUBLISHED');

    // Admin nhận điều phối từ hai tab cùng lúc: đúng một bên thắng, bên kia nhận STALE_VERSION
    const optIn = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.sentOptIn}`,
      auth: as('admin'),
    });
    expect(optIn.status).toBe(200);
    const stale = String(optIn.body.version);
    const coordinate = () =>
      t.request({
        method: 'POST',
        url: `/rfqs/${DEMO_REQUEST_IDS.sentOptIn}/coordinate`,
        auth: as('admin'),
        headers: { 'if-match': stale },
      });
    const [tabA, tabB] = await Promise.all([coordinate(), coordinate()]);
    expect([tabA.status, tabB.status].sort()).toEqual([200, 409]);
    expect((tabA.status === 409 ? tabA : tabB).body.code).toBe('STALE_VERSION');

    // Hộ đề xuất tham gia yêu cầu đã được mời
    const sent = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.sentCoordinated}`,
      auth: as('household'),
    });
    expect(sent.status).toBe(200);
    const contribution = await t.request({
      method: 'POST',
      url: `/rfqs/${DEMO_REQUEST_IDS.sentCoordinated}/contributions`,
      auth: as('household'),
      body: {
        maxQuantity: 500,
        unitPriceVnd: 32_000,
        completionDate: new Date(
          new Date(sent.body.requiredBy).getTime() - 10 * 86_400_000,
        ).toISOString(),
      },
    });
    expect(contribution.status).toBe(201);

    // Buyer chốt chào giá chia 4 hộ
    const quotations = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.biddingToAccept}/quotations`,
      auth: as('buyer'),
    });
    expect(quotations.status).toBe(200);
    const submitted = quotations.body.filter((q: { status: string }) => q.status === 'SUBMITTED');
    expect(submitted).toHaveLength(1);
    const toAccept = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.biddingToAccept}`,
      auth: as('buyer'),
    });
    const accepted = await t.request({
      method: 'POST',
      url: `/rfqs/${DEMO_REQUEST_IDS.biddingToAccept}/accept`,
      auth: as('buyer'),
      headers: { 'if-match': String(toAccept.body.version) },
      body: { quotationId: submitted[0].id },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe('ACCEPTED');
    const proposed = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.biddingToAccept}/allocations`,
      auth: as('buyer'),
    });
    expect(proposed.body).toHaveLength(4);

    // Hộ xác nhận phân bổ của đơn "acceptedConfirm", Admin bắt đầu sản xuất
    const mineAlloc = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.acceptedConfirm}/allocations`,
      auth: as('household'),
    });
    expect(mineAlloc.body).toHaveLength(1);
    expect(mineAlloc.body[0].status).toBe('PROPOSED');
    const confirmed = await t.request({
      method: 'POST',
      url: `/allocations/${mineAlloc.body[0].id}/confirm`,
      auth: as('household'),
      headers: { 'if-match': String(mineAlloc.body[0].version) },
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('CONFIRMED');
    const orderRfq = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.acceptedConfirm}`,
      auth: as('admin'),
    });
    const started = await t.request({
      method: 'POST',
      url: `/rfqs/${DEMO_REQUEST_IDS.acceptedConfirm}/start-production`,
      auth: as('admin'),
      headers: { 'if-match': String(orderRfq.body.version) },
    });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe('IN_PRODUCTION');

    // Tiến độ đến hết số lượng → Buyer nhận hàng
    const production = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.inProduction}/allocations`,
      auth: as('household'),
    });
    expect(production.body).toHaveLength(1);
    expect(production.body[0]).toMatchObject({
      status: 'IN_PROGRESS',
      quantity: 500,
      completedQty: 350,
    });
    const progressed = await t.request({
      method: 'POST',
      url: `/allocations/${production.body[0].id}/progress`,
      auth: as('household'),
      headers: { 'if-match': String(production.body[0].version) },
      body: { completedQty: 500 },
    });
    expect(progressed.status).toBe(200);
    expect(progressed.body.status).toBe('DONE');
    const delivery = await t.request({
      method: 'GET',
      url: `/rfqs/${DEMO_REQUEST_IDS.inProduction}`,
      auth: as('buyer'),
    });
    const received = await t.request({
      method: 'POST',
      url: `/rfqs/${DEMO_REQUEST_IDS.inProduction}/receive`,
      auth: as('buyer'),
      headers: { 'if-match': String(delivery.body.version) },
    });
    expect(received.status).toBe(200);
    expect(received.body.status).toBe('DELIVERED');
  });
});
