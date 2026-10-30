import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  assertObjectKey,
  type BucketKind,
  type ObjectStorage,
  PRESIGN_TTL_SECONDS,
  type PutObjectInput,
} from './object-storage.js';

export interface LocalStorageConfig {
  /** Thư mục Caddy phục vụ ở `/media/*` (chỉ chứa ảnh công khai). */
  readonly publicDir: string;
  /** Thư mục KHÔNG được phục vụ trực tiếp; tệp ra ngoài qua URL ký do API kiểm. */
  readonly privateDir: string;
  /** Gốc URL công khai của `publicDir`, vd. `http://localhost:8080/media`. */
  readonly publicBaseUrl: string;
  /** Gốc URL của endpoint API đọc tệp riêng tư đã ký, vd. `http://localhost:8080/api/v1/media/files`. */
  readonly signedBaseUrl: string;
  /** Khóa HMAC ký URL tệp riêng tư. */
  readonly signingKey: string;
  readonly now?: () => number;
}

/**
 * Đĩa cục bộ cho test, CI và demo offline (ADR-14 §5, NFR-PORT-03). Giữ đúng ngữ nghĩa của S3:
 * tệp riêng tư nằm ngoài thư mục được phục vụ và chỉ đọc được qua URL ký có hạn.
 */
export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly config: LocalStorageConfig) {
    if (config.signingKey.length < 16) throw new Error('STORAGE_SIGNING_KEY is too short');
  }

  async put(input: PutObjectInput): Promise<void> {
    const path = this.path(input.bucket, input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
  }

  async get(bucket: BucketKind, key: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(this.path(bucket, key)));
  }

  async presignGet(key: string, ttlSeconds = PRESIGN_TTL_SECONDS): Promise<string> {
    assertObjectKey(key);
    const expires = Math.floor(this.now() / 1000) + ttlSeconds;
    const query = new URLSearchParams({
      expires: String(expires),
      signature: this.sign(key, expires),
    });
    return `${this.config.signedBaseUrl}/${key}?${query}`;
  }

  publicUrl(key: string): string {
    assertObjectKey(key);
    return `${this.config.publicBaseUrl}/${key}`;
  }

  /** Đọc tệp riêng tư theo URL ký; `null` khi chữ ký sai hoặc đã hết hạn. */
  async readSigned(key: string, expires: string, signature: string): Promise<Uint8Array | null> {
    try {
      assertObjectKey(key);
    } catch {
      return null;
    }
    const at = Number(expires);
    if (!Number.isInteger(at) || at * 1000 < this.now()) return null;
    const expected = Buffer.from(this.sign(key, at));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return this.get('private', key);
  }

  private sign(key: string, expires: number): string {
    return createHmac('sha256', this.config.signingKey)
      .update(`${key}\n${expires}`)
      .digest('base64url');
  }

  private path(bucket: BucketKind, key: string): string {
    assertObjectKey(key);
    return join(bucket === 'public' ? this.config.publicDir : this.config.privateDir, key);
  }

  private now(): number {
    return this.config.now?.() ?? Date.now();
  }
}
