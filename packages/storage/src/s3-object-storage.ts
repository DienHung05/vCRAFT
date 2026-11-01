import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  assertObjectKey,
  type BucketKind,
  type ObjectStorage,
  PRESIGN_TTL_SECONDS,
  type PutObjectInput,
} from './object-storage.js';

export interface S3StorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly forcePathStyle: boolean;
  readonly buckets: Readonly<Record<BucketKind, string>>;
  /** Gốc URL công khai của bucket công khai (không có `/` cuối). */
  readonly publicBaseUrl: string;
}

/** Supabase Storage (hoặc S3/R2 bất kỳ) qua giao thức S3 (ADR-14 §3). */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<void> {
    assertObjectKey(input.key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.buckets[input.bucket],
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        ...(input.cacheControl && { CacheControl: input.cacheControl }),
      }),
    );
  }

  async get(bucket: BucketKind, key: string): Promise<Uint8Array> {
    assertObjectKey(key);
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.buckets[bucket], Key: key }),
    );
    if (!result.Body) throw new Error(`object ${key} has no body`);
    return result.Body.transformToByteArray();
  }

  async delete(bucket: BucketKind, key: string): Promise<void> {
    assertObjectKey(key);
    // S3 DeleteObject succeeds when the key does not exist.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.buckets[bucket], Key: key }),
    );
  }

  presignGet(key: string, ttlSeconds = PRESIGN_TTL_SECONDS): Promise<string> {
    assertObjectKey(key);
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.buckets.private, Key: key }),
      { expiresIn: ttlSeconds },
    );
  }

  publicUrl(key: string): string {
    assertObjectKey(key);
    return `${this.config.publicBaseUrl}/${key}`;
  }
}
