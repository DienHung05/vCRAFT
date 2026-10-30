import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertObjectKey, createObjectStorage, LocalObjectStorage } from '../src';

let root: string;
let now: number;
let storage: LocalObjectStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vcraft-storage-'));
  now = Date.UTC(2027, 0, 8, 9, 0, 0);
  storage = new LocalObjectStorage({
    publicDir: join(root, 'public'),
    privateDir: join(root, 'private'),
    publicBaseUrl: 'http://localhost:8080/media',
    signedBaseUrl: 'http://localhost:8080/api/v1/media/files',
    signingKey: 'test-signing-key-0123456789',
    now: () => now,
  });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const body = new Uint8Array([1, 2, 3]);

describe('LocalObjectStorage', () => {
  it('tệp riêng tư nằm ngoài thư mục được phục vụ công khai', async () => {
    await storage.put({ bucket: 'private', key: 'originals/a/b', body, contentType: 'image/jpeg' });
    await expect(readdir(join(root, 'public'))).rejects.toThrow();
    expect(await storage.get('private', 'originals/a/b')).toEqual(body);
  });

  it('URL ký đọc được trước hạn, hết hạn hoặc sửa chữ ký thì không', async () => {
    await storage.put({
      bucket: 'private',
      key: 'docs/cert',
      body,
      contentType: 'application/pdf',
    });
    const url = new URL(await storage.presignGet('docs/cert', 300));
    const expires = url.searchParams.get('expires') ?? '';
    const signature = url.searchParams.get('signature') ?? '';
    expect(url.pathname).toBe('/api/v1/media/files/docs/cert');

    expect(await storage.readSigned('docs/cert', expires, signature)).toEqual(body);
    expect(await storage.readSigned('docs/other', expires, signature)).toBeNull();
    expect(
      await storage.readSigned('docs/cert', String(Number(expires) + 60), signature),
    ).toBeNull();
    expect(await storage.readSigned('docs/cert', expires, `${signature.slice(1)}x`)).toBeNull();

    now += 301_000;
    expect(await storage.readSigned('docs/cert', expires, signature)).toBeNull();
  });

  it('URL công khai chỉ dành cho bucket công khai', () => {
    expect(storage.publicUrl('v/abc/640.webp')).toBe('http://localhost:8080/media/v/abc/640.webp');
  });
});

describe('khóa đối tượng', () => {
  it('không cho thoát thư mục', () => {
    for (const bad of ['../x', 'a/../../x', '/abs', 'a//b', '', 'a/.hidden/../b'])
      expect(() => assertObjectKey(bad)).toThrow();
    expect(() => assertObjectKey('originals/0190-abc/x.jpg')).not.toThrow();
  });
});

describe('createObjectStorage', () => {
  it('báo thiếu biến môi trường rõ ràng', () => {
    expect(() => createObjectStorage({ STORAGE_DRIVER: 's3' })).toThrow(/S3_ENDPOINT/);
    expect(() => createObjectStorage({ STORAGE_DRIVER: 'ftp' })).toThrow(/s3 \| local/);
  });
});
