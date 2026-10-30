import { LocalObjectStorage } from './local-object-storage.js';
import type { ObjectStorage } from './object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

export * from './local-object-storage.js';
export * from './object-storage.js';
export * from './s3-object-storage.js';

export type StorageEnv = Readonly<Record<string, string | undefined>>;

function required(env: StorageEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required for STORAGE_DRIVER=${env.STORAGE_DRIVER ?? 's3'}`);
  return value;
}

const trimSlash = (url: string) => url.replace(/\/+$/, '');

/** Chọn adapter theo `STORAGE_DRIVER` (`s3` mặc định | `local`), xem `.env.example`. */
export function createObjectStorage(env: StorageEnv = process.env): ObjectStorage {
  const driver = env.STORAGE_DRIVER?.trim().toLowerCase() || 's3';
  if (driver === 'local') {
    return new LocalObjectStorage({
      publicDir: required(env, 'STORAGE_LOCAL_DIR'),
      privateDir: required(env, 'STORAGE_LOCAL_PRIVATE_DIR'),
      publicBaseUrl: trimSlash(required(env, 'MEDIA_PUBLIC_BASE_URL')),
      signedBaseUrl: `${trimSlash(required(env, 'APP_URL'))}/api/v1/media/files`,
      signingKey: required(env, 'STORAGE_SIGNING_KEY'),
    });
  }
  if (driver !== 's3') throw new Error(`STORAGE_DRIVER="${env.STORAGE_DRIVER}" must be s3 | local`);
  return new S3ObjectStorage({
    endpoint: required(env, 'S3_ENDPOINT'),
    region: required(env, 'S3_REGION'),
    accessKeyId: required(env, 'S3_ACCESS_KEY'),
    secretAccessKey: required(env, 'S3_SECRET_KEY'),
    forcePathStyle: env.S3_FORCE_PATH_STYLE?.trim().toLowerCase() !== 'false',
    buckets: {
      public: env.S3_BUCKET_PUBLIC?.trim() || 'vcraft-media',
      private: env.S3_BUCKET_PRIVATE?.trim() || 'vcraft-private',
    },
    publicBaseUrl: trimSlash(required(env, 'MEDIA_PUBLIC_BASE_URL')),
  });
}
