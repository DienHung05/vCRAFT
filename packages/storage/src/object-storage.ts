/** Hai bucket của ADR-14: `public` (ảnh đã tối ưu, cache vĩnh viễn) và `private` (bản gốc, giấy tờ). */
export type BucketKind = 'public' | 'private';

export interface PutObjectInput {
  readonly bucket: BucketKind;
  readonly key: string;
  readonly body: Uint8Array;
  readonly contentType: string;
  readonly cacheControl?: string;
}

/** Hạn của URL ký cho tệp riêng tư (FR-MEDIA-04). */
export const PRESIGN_TTL_SECONDS = 300;

/** Cache cho biến thể ảnh: key chứa hash nội dung nên không bao giờ đổi. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Cổng lưu trữ đối tượng (ARCHITECTURE §4.4 `StoragePort`). Đổi nhà cung cấp chỉ cần đổi biến môi
 * trường. Tệp riêng tư chỉ ra ngoài qua {@link ObjectStorage.presignGet}; không có URL công khai.
 */
export interface ObjectStorage {
  put(input: PutObjectInput): Promise<void>;
  get(bucket: BucketKind, key: string): Promise<Uint8Array>;
  /** Xóa một đối tượng (xóa dữ liệu cá nhân, NFR-SEC-07). Không có đối tượng thì không lỗi. */
  delete(bucket: BucketKind, key: string): Promise<void>;
  /** URL đọc tệp riêng tư, hết hạn sau `ttlSeconds`. */
  presignGet(key: string, ttlSeconds?: number): Promise<string>;
  /** URL công khai của một đối tượng trong bucket công khai. */
  publicUrl(key: string): string;
}

/** Không cho key thoát khỏi thư mục/bucket: chỉ đoạn chữ, số, `-`, `_`, `.` nối bằng `/`. */
const KEY_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/;

export function assertObjectKey(key: string): void {
  if (key.length > 300 || !KEY_PATTERN.test(key) || key.split('/').includes('..')) {
    throw new Error(`invalid object key: ${key}`);
  }
}
