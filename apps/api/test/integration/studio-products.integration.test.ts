import { AuditLog, Household } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

// PNG 1×1 hợp lệ: `POST /media` kiểm magic bytes thật.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Issue #32 — Sửa sản phẩm và ảnh trong Studio (FR-PRD-01, 02): chỉ chủ hộ, ảnh phải là của chính họ. */
describe('Studio products', () => {
  let db: TestDatabase;
  let t: TestApp;
  let owner: { auth: string };
  let other: { auth: string };
  let product: { id: string; version: number; slug: string };

  async function upload(auth: string): Promise<string> {
    const boundary = 'vcraftboundary';
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      PNG,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const res = await t.app.inject({
      method: 'POST',
      url: '/api/v1/media?purpose=PRODUCT',
      headers: {
        authorization: auth,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload,
    });
    expect(res.statusCode).toBe(202);
    return JSON.parse(res.body).id;
  }

  const patch = (body: object, version = product.version, auth = owner.auth) =>
    t.request({
      method: 'PATCH',
      url: `/me/household/products/${product.id}`,
      auth,
      headers: { 'if-match': `"${version}"` },
      body,
    });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
    owner = await t.createUser('BUYER');
    other = await t.createUser('BUYER');
    for (const [user, slug] of [
      [owner, 'gom-a'],
      [other, 'gom-b'],
    ] as const) {
      await t.request({
        method: 'POST',
        url: '/me/household',
        auth: user.auth,
        body: { name: `Hộ ${slug}`, slug, history: '' },
      });
    }
    // Only an approved household posts products (GH#237).
    await db.orm.em
      .fork()
      .nativeUpdate(Household, { slug: { $in: ['gom-a', 'gom-b'] } }, { status: 'APPROVED' });
    const created = await t.request({
      method: 'POST',
      url: '/me/household/products',
      auth: owner.auth,
      body: { name: 'Bình men lam', category: 'VASE', priceVnd: 500_000, stock: 2 },
    });
    expect(created.status).toBe(201);
    product = created.body;
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('chủ hộ sửa thông tin; tìm kiếm theo tên mới', async () => {
    const res = await patch({ name: 'Bình gốm hoa sen', priceVnd: 750_000, material: 'Đất sét' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Bình gốm hoa sen', priceVnd: 750_000, stock: 2 });
    product = res.body;
  });

  it('bản cũ bị từ chối; hộ khác không thấy sản phẩm; thiếu tên thì lỗi kiểm dữ liệu', async () => {
    expect((await patch({ stock: 1 }, product.version - 1)).status).toBe(409);
    // AC-4 (GH#237): another household's product is a 403 and an audit entry, not a hidden 404.
    expect((await patch({ stock: 1 }, product.version, other.auth)).status).toBe(403);
    const denied = await db.orm.em
      .fork()
      .find(AuditLog, { action: 'access.denied', entityId: product.id });
    expect(denied).toHaveLength(1);
    expect((await patch({ name: 'x' })).status).toBe(422);
  });

  it('ảnh: đúng thứ tự gửi lên, bắt buộc mô tả, tối đa 12, không gắn ảnh của người khác', async () => {
    const first = await upload(owner.auth);
    const second = await upload(owner.auth);
    const foreign = await upload(other.auth);
    expect((await patch({ images: [{ mediaId: first, alt: '' }] })).status).toBe(422);
    expect((await patch({ images: [{ mediaId: foreign, alt: 'Ảnh người khác' }] })).status).toBe(
      403,
    );
    expect(
      (
        await patch({
          images: Array.from({ length: 13 }, () => ({ mediaId: first, alt: 'Ảnh bình' })),
        })
      ).status,
    ).toBe(422);

    const res = await patch({
      images: [
        { mediaId: second, alt: 'Mặt sau của bình' },
        { mediaId: first, alt: 'Mặt trước của bình' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.images.map((i: { mediaId: string }) => i.mediaId)).toEqual([second, first]);
    // Chưa qua worker nên chưa có URL: giao diện hiện "đang xử lý", trang công khai bỏ qua.
    expect(res.body.images[0].url).toBeNull();
    expect(res.body.coverUrl).toBeNull();
    product = res.body;

    const mine = await t.request({ method: 'GET', url: '/me/household', auth: owner.auth });
    expect(mine.body.products[0].images).toHaveLength(2);
  });
});
