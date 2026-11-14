import { MediaAssetResponseSchema, MediaReadUrlResponseSchema } from '@vcraft/contracts';
import { MediaAsset, OutboxEvent } from '@vcraft/database';
import { MEDIA_MAX_BYTES } from '@vcraft/domain';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { processMediaAsset } from '../../../worker/src/processors/media/process-media.js';
import { relayOutbox } from '../../../worker/src/processors/outbox/relay-outbox.js';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Đủ magic bytes để `file-type` nhận ra; API không decode ảnh (việc của worker). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

function multipart(bytes: Buffer, mime: string) {
  const boundary = `----vcraft${crypto.randomUUID()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="upload"\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('media pipeline: kiểm tra ở biên và tệp riêng tư', () => {
  let db: TestDatabase;
  let t: TestApp;
  let household: { id: string; auth: string };
  let otherHousehold: { auth: string };
  let admin: { auth: string };
  let buyer: { auth: string };

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    household = await t.createUser('HOUSEHOLD');
    otherHousehold = await t.createUser('HOUSEHOLD');
    admin = await t.createUser('ADMIN');
    buyer = await t.createUser('BUYER');
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  async function upload(auth: string, purpose: string, bytes: Buffer, mime: string) {
    const body = multipart(bytes, mime);
    const res = await t.app.inject({
      method: 'POST',
      url: `/api/v1/media?purpose=${purpose}`,
      headers: { authorization: auth, ...body.headers },
      payload: body.payload,
    });
    return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
  }

  it('ảnh nhật ký: 202 PROCESSING, bản gốc vào bucket riêng tư, outbox báo worker cùng giao dịch', async () => {
    const res = await upload(household.auth, 'JOURNAL', PNG, 'image/png');
    expect(res.status).toBe(202);
    const asset = MediaAssetResponseSchema.parse(res.body);
    expect(asset).toMatchObject({
      status: 'PROCESSING',
      visibility: 'PUBLIC',
      mimeType: 'image/png',
      sizeBytes: PNG.byteLength,
      variants: [],
    });

    const em = db.orm.em.fork();
    const stored = await em.findOneOrFail(MediaAsset, asset.id);
    expect(await t.storage.get('private', stored.originalKey)).toEqual(new Uint8Array(PNG));
    await expect(t.storage.get('public', stored.originalKey)).rejects.toThrow();
    const events = await em.find(OutboxEvent, { type: 'media.uploaded' });
    expect(events.map((event) => event.payload.assetId)).toContain(asset.id);
  });

  it('worker: outbox → chuyển đổi → READY, biến thể nằm ở bucket công khai, không còn EXIF', async () => {
    const photo = await sharp({
      create: { width: 1400, height: 900, channels: 3, background: '#a0522d' },
    })
      .withExif({ IFD0: { Make: 'TestPhone' } })
      .jpeg()
      .toBuffer();
    const res = await upload(household.auth, 'JOURNAL', photo, 'image/jpeg');
    expect(res.status).toBe(202);

    const jobs: string[] = [];
    await relayOutbox(db.orm, async (event) => {
      if (event.type === 'media.uploaded') jobs.push(String(event.payload.assetId));
    });
    expect(jobs).toContain(res.body.id);
    for (const assetId of jobs)
      await processMediaAsset({ orm: db.orm, storage: t.storage }, assetId);

    const ready = await t.request({
      method: 'GET',
      url: `/media/${res.body.id}`,
      auth: household.auth,
    });
    const asset = MediaAssetResponseSchema.parse(ready.body);
    expect(asset).toMatchObject({ status: 'READY', width: 1400, height: 900 });
    expect(asset.variants.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.avif',
      '320.webp',
      '640.avif',
      '640.webp',
      '960.avif',
      '960.webp',
      '1280.avif',
      '1280.webp',
    ]);
    for (const variant of asset.variants) {
      expect(variant.url.startsWith('http://localhost:8080/media/v/')).toBe(true);
      const key = variant.url.slice('http://localhost:8080/media/'.length);
      expect((await sharp(await t.storage.get('public', key)).metadata()).exif).toBeUndefined();
    }

    // Chạy lại job (BullMQ thử lại) không đổi gì
    const before = (await db.orm.em.fork().findOneOrFail(MediaAsset, asset.id)).version;
    await processMediaAsset({ orm: db.orm, storage: t.storage }, asset.id);
    expect((await db.orm.em.fork().findOneOrFail(MediaAsset, asset.id)).version).toBe(before);
  });

  it('ảnh hỏng (đúng magic bytes nhưng không decode được) ⇒ FAILED, không có biến thể', async () => {
    const res = await upload(household.auth, 'PRODUCT', PNG.subarray(0, 40), 'image/png');
    expect(res.status).toBe(202);
    await processMediaAsset({ orm: db.orm, storage: t.storage }, res.body.id);
    const failed = await t.request({
      method: 'GET',
      url: `/media/${res.body.id}`,
      auth: household.auth,
    });
    expect(failed.body).toMatchObject({ status: 'FAILED', variants: [] });
  });

  it('tải lại đúng nội dung đó thì dùng lại tệp cũ', async () => {
    const first = await upload(household.auth, 'PRODUCT', PNG, 'image/png');
    const second = await upload(household.auth, 'PRODUCT', PNG, 'image/png');
    expect(second.body.id).toBe(first.body.id);
  });

  it('khai là ảnh nhưng nội dung là HTML ⇒ 415, không lưu gì', async () => {
    const before = await db.orm.em.fork().count(MediaAsset, {});
    const res = await upload(household.auth, 'JOURNAL', HTML, 'image/jpeg');
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('MEDIA_UNSUPPORTED_TYPE');
    expect(await db.orm.em.fork().count(MediaAsset, {})).toBe(before);
  });

  it('khai sai loại ảnh (PNG khai là JPEG) ⇒ 415', async () => {
    const res = await upload(household.auth, 'JOURNAL', PNG, 'image/jpeg');
    expect(res.status).toBe(415);
  });

  it('HEIC/HEIF ảnh công khai được nhận và chờ worker chuyển đổi (GH#252)', async () => {
    const ftyp = (brand: string) =>
      Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from(`ftyp${brand}`),
        Buffer.alloc(4),
        Buffer.from(`mif1${brand}`),
        Buffer.alloc(64),
      ]);
    // Phones declare image/heic even when the brand sniffs as heif.
    const heic = await upload(household.auth, 'PRODUCT', ftyp('heic'), 'image/heic');
    expect(heic.status).toBe(202);
    expect(heic.body).toMatchObject({ status: 'PROCESSING', mimeType: 'image/heic' });
    const heif = await upload(household.auth, 'PRODUCT', ftyp('mif1'), 'image/heic');
    expect(heif.status).toBe(202);
    expect(heif.body.mimeType).toBe('image/heif');
    // Private documents are never converted, so HEIC stays out of them.
    const cert = await upload(household.auth, 'CERTIFICATE', ftyp('heic'), 'image/heic');
    expect(cert.status).toBe(415);
  });

  it('ảnh quá 50 megapixel bị từ chối ngay lúc tải lên, 50 MP thì nhận (GH#252)', async () => {
    const withSize = (width: number, height: number) => {
      const png = Buffer.from(PNG);
      png.writeUInt32BE(width, 16);
      png.writeUInt32BE(height, 20);
      return png;
    };
    const before = await db.orm.em.fork().count(MediaAsset, {});
    const huge = await upload(household.auth, 'PRODUCT', withSize(8000, 7000), 'image/png');
    expect(huge.status).toBe(422);
    expect(huge.body.code).toBe('MEDIA_RESOLUTION_TOO_HIGH');
    expect(await db.orm.em.fork().count(MediaAsset, {})).toBe(before);
    const limit = await upload(household.auth, 'PRODUCT', withSize(10_000, 5_000), 'image/png');
    expect(limit.status).toBe(202);
  });

  it('nhận tệp 11 MB (giới hạn là 15 MiB) (GH#252)', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(11 * 1024 * 1024)]);
    const res = await upload(household.auth, 'JOURNAL', big, 'image/png');
    expect(res.status).toBe(202);
  });

  it('worker: READY ngay sau khi có các bản WebP, AVIF được thêm vào sau (GH#252)', async () => {
    const photo = await sharp({
      create: { width: 700, height: 500, channels: 3, background: '#3b5079' },
    })
      .jpeg()
      .toBuffer();
    const res = await upload(household.auth, 'JOURNAL', photo, 'image/jpeg');
    await processMediaAsset({ orm: db.orm, storage: t.storage }, res.body.id);
    const asset = await db.orm.em.fork().findOneOrFail(MediaAsset, res.body.id);
    expect(asset).toMatchObject({ status: 'READY', width: 700, height: 500 });
    expect(asset.thumbhash).toBeTruthy();
    expect(asset.variants.map((v) => `${v.width}.${v.format}`)).toEqual([
      '320.avif',
      '320.webp',
      '640.avif',
      '640.webp',
    ]);
  });

  it('vượt 15 MiB ⇒ 413 MEDIA_TOO_LARGE', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MEDIA_MAX_BYTES)]);
    const res = await upload(household.auth, 'JOURNAL', big, 'image/png');
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('MEDIA_TOO_LARGE');
  });

  it('PDF không được làm ảnh công khai', async () => {
    const res = await upload(household.auth, 'PRODUCT', PDF, 'application/pdf');
    expect(res.status).toBe(415);
  });

  it('người mua không tải lên được; thiếu đăng nhập ⇒ 401; mục đích lạ ⇒ 422', async () => {
    expect((await upload(buyer.auth, 'JOURNAL', PNG, 'image/png')).status).toBe(403);
    const body = multipart(PNG, 'image/png');
    const anonymous = await t.app.inject({
      method: 'POST',
      url: '/api/v1/media?purpose=JOURNAL',
      headers: body.headers,
      payload: body.payload,
    });
    expect(anonymous.statusCode).toBe(401);
    expect((await upload(household.auth, 'AVATAR', PNG, 'image/png')).status).toBe(422);
  });

  it('không phải multipart ⇒ 400', async () => {
    const res = await t.request({
      method: 'POST',
      url: '/media?purpose=JOURNAL',
      auth: household.auth,
      body: { file: 'x' },
    });
    expect(res.status).toBe(400);
  });

  it('giấy chứng nhận: riêng tư, không có URL công khai, chỉ đọc qua URL ký 5 phút', async () => {
    const res = await upload(household.auth, 'CERTIFICATE', PDF, 'application/pdf');
    expect(res.status).toBe(202);
    const asset = MediaAssetResponseSchema.parse(res.body);
    expect(asset).toMatchObject({ visibility: 'PRIVATE', status: 'READY', variants: [] });
    expect(JSON.stringify(res.body)).not.toContain('/media/');
    // Tệp riêng tư không cần worker: không có sự kiện chuyển đổi
    const events = await db.orm.em.fork().find(OutboxEvent, { type: 'media.uploaded' });
    expect(events.map((event) => event.payload.assetId)).not.toContain(asset.id);

    const own = await t.request({
      method: 'GET',
      url: `/media/${asset.id}/read-url`,
      auth: household.auth,
    });
    expect(own.status).toBe(200);
    const signed = MediaReadUrlResponseSchema.parse(own.body);
    const ttl = Date.parse(signed.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(290_000);
    expect(ttl).toBeLessThanOrEqual(300_000);

    const url = new URL(signed.url);
    const file = await t.app.inject({ method: 'GET', url: `${url.pathname}${url.search}` });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(file.rawPayload.equals(PDF)).toBe(true);

    url.searchParams.set('signature', 'forged');
    const forged = await t.app.inject({ method: 'GET', url: `${url.pathname}${url.search}` });
    expect(forged.statusCode).toBe(404);

    const admins = await t.request({
      method: 'GET',
      url: `/media/${asset.id}/read-url`,
      auth: admin.auth,
    });
    expect(admins.status).toBe(200);
    for (const outsider of [otherHousehold.auth]) {
      const denied = await t.request({
        method: 'GET',
        url: `/media/${asset.id}/read-url`,
        auth: outsider,
      });
      expect(denied.status).toBe(404);
    }
  });

  it('re-upload reuses a recent PROCESSING asset but re-enqueues a stuck one (GH#345)', async () => {
    const owner = await t.createUser('HOUSEHOLD');
    const png = Buffer.concat([PNG, Buffer.from('stuck-asset')]);
    const first = await upload(owner.auth, 'JOURNAL', png, 'image/png');
    expect(first.status).toBe(202);
    const count = () => db.orm.em.fork().count(OutboxEvent, { type: 'media.uploaded' });
    const before = await count();

    const again = await upload(owner.auth, 'JOURNAL', png, 'image/png');
    expect(again.body.id).toBe(first.body.id);
    expect(await count()).toBe(before);

    await db.orm.em
      .fork()
      .nativeUpdate(
        MediaAsset,
        { id: first.body.id },
        { updatedAt: new Date(Date.now() - 11 * 60_000) },
      );
    const stuck = await upload(owner.auth, 'JOURNAL', png, 'image/png');
    expect(stuck.body.id).toBe(first.body.id);
    expect(stuck.body.status).toBe('PROCESSING');
    expect(await count()).toBe(before + 1);

    // The window restarts, so an immediate third upload does not enqueue again.
    await upload(owner.auth, 'JOURNAL', png, 'image/png');
    expect(await count()).toBe(before + 1);
  });
});
