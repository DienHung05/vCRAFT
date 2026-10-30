import { createHash } from 'node:crypto';
import { MikroORM } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import type { MediaAssetResponse, MediaReadUrlResponse } from '@vcraft/contracts';
import { MediaAsset, OutboxEvent } from '@vcraft/database';
import { checkMediaUpload, type MediaPurpose } from '@vcraft/domain';
import { LocalObjectStorage, type ObjectStorage, PRESIGN_TTL_SECONDS } from '@vcraft/storage';
import { fileTypeFromBuffer } from 'file-type';
import type { Actor } from '../../../common/auth/auth.guard';
import { unwrap } from '../../../common/domain/unwrap';
import { forbidden, notFound } from '../../../common/errors/app-error';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';

/** Sự kiện outbox để worker chuyển đổi ảnh (ARCHITECTURE §7.1). */
export const MEDIA_UPLOADED_EVENT = 'media.uploaded';

export interface UploadedFile {
  readonly declaredMime: string;
  readonly bytes: Uint8Array;
}

/**
 * FR-MEDIA-03/04: kiểm loại thật (magic bytes) và kích thước ở biên, lưu bản gốc vào bucket riêng tư,
 * ghi `media.uploaded` vào outbox cùng giao dịch để worker sinh biến thể công khai.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly orm: MikroORM,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async upload(
    actor: Actor,
    purpose: MediaPurpose,
    file: UploadedFile,
  ): Promise<MediaAssetResponse> {
    if (actor.locked) throw forbidden();
    const sniffed = await fileTypeFromBuffer(file.bytes);
    const plan = unwrap(
      checkMediaUpload({
        purpose,
        declaredMime: file.declaredMime,
        sniffedMime: sniffed?.mime,
        sizeBytes: file.bytes.byteLength,
      }),
    );
    const sha256 = createHash('sha256').update(file.bytes).digest('hex');

    // FR-MEDIA-05: cùng người, cùng mục đích, cùng nội dung ⇒ dùng lại tệp cũ.
    const existing = await this.orm.em.fork().findOne(MediaAsset, {
      ownerId: actor.id,
      purpose,
      sha256,
      status: { $ne: 'FAILED' },
    });
    if (existing) return this.toResponse(existing);

    return this.orm.em.fork().transactional(async (em) => {
      const asset = em.create(MediaAsset, {
        ownerId: actor.id,
        purpose,
        visibility: plan.visibility,
        status: plan.convert ? 'PROCESSING' : 'READY',
        mimeType: plan.mime,
        sizeBytes: file.bytes.byteLength,
        sha256,
        originalKey: '',
      });
      asset.originalKey = `originals/${actor.id}/${asset.id}`;
      await this.storage.put({
        bucket: 'private',
        key: asset.originalKey,
        body: file.bytes,
        contentType: plan.mime,
      });
      if (plan.convert)
        em.create(OutboxEvent, { type: MEDIA_UPLOADED_EVENT, payload: { assetId: asset.id } });
      await em.flush();
      return this.toResponse(asset);
    });
  }

  async get(actor: Actor, id: string): Promise<MediaAssetResponse> {
    return this.toResponse(await this.readable(actor, id));
  }

  /** Bản gốc (và mọi tệp riêng tư) chỉ ra ngoài qua URL ký 5 phút. */
  async readUrl(actor: Actor, id: string): Promise<MediaReadUrlResponse> {
    const asset = await this.readable(actor, id);
    const url = await this.storage.presignGet(asset.originalKey, PRESIGN_TTL_SECONDS);
    return { url, expiresAt: new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString() };
  }

  /** Chỉ có khi `STORAGE_DRIVER=local`: phục vụ URL ký do {@link LocalObjectStorage} sinh. */
  async readSignedLocal(key: string, expires: string, signature: string) {
    if (!(this.storage instanceof LocalObjectStorage)) throw notFound();
    const bytes = await this.storage.readSigned(key, expires, signature).catch(() => null);
    if (!bytes) throw notFound();
    const type = await fileTypeFromBuffer(bytes);
    return { bytes, mime: type?.mime ?? 'application/octet-stream' };
  }

  /** Người tải lên hoặc Ban quản lý; người khác nhận 404 để không lộ sự tồn tại của tệp. */
  private async readable(actor: Actor, id: string): Promise<MediaAsset> {
    const asset = await this.orm.em.fork().findOne(MediaAsset, id);
    if (!asset || (asset.ownerId !== actor.id && actor.role !== 'ADMIN')) throw notFound();
    return asset;
  }

  private toResponse(asset: MediaAsset): MediaAssetResponse {
    const published = asset.visibility === 'PUBLIC' && asset.status === 'READY';
    return {
      id: asset.id,
      version: asset.version,
      purpose: asset.purpose,
      visibility: asset.visibility,
      status: asset.status,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      sha256: asset.sha256,
      width: asset.width ?? null,
      height: asset.height ?? null,
      thumbhash: asset.thumbhash ?? null,
      dominantColor: asset.dominantColor ?? null,
      variants: published
        ? asset.variants.map((variant) => ({
            format: variant.format,
            width: variant.width,
            height: variant.height,
            url: this.storage.publicUrl(variant.key),
          }))
        : [],
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
