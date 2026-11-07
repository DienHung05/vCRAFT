import { createHash } from 'node:crypto';
import { MikroORM } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ExportedMediaDto,
  MediaAssetResponse,
  MediaReadUrlResponse,
  MediaVariantResponse,
  PublicImageDto,
} from '@vcraft/contracts';
import { publicCredit } from '@vcraft/contracts';
import {
  MediaAsset,
  type MediaCredit,
  MediaLink,
  type MediaLinkRole,
  type MediaLinkTarget,
  OutboxEvent,
  type Product,
} from '@vcraft/database';
import { checkMediaUpload, type MediaPurpose } from '@vcraft/domain';
import { LocalObjectStorage, type ObjectStorage, PRESIGN_TTL_SECONDS } from '@vcraft/storage';
import { fileTypeFromBuffer } from 'file-type';
import type { Actor } from '../../../common/auth/auth.guard';
import { unwrap } from '../../../common/domain/unwrap';
import { forbidden, notFound } from '../../../common/errors/app-error';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';
import { ConsentService } from '../../privacy/application/consent.service';

/** Sự kiện outbox để worker chuyển đổi ảnh (ARCHITECTURE §7.1). */
export const MEDIA_UPLOADED_EVENT = 'media.uploaded';

/** `DOCUMENT` files are private papers and never reach the public API. */
export type PublicLinkRole = Exclude<MediaLinkRole, 'DOCUMENT'>;

export interface LinkedImage {
  role: PublicLinkRole;
  image: PublicImageDto;
}

/** A processed public file: the single ~1280 px URL plus every size, for `srcset`. */
export interface PublicMedia {
  url: string;
  variants: MediaVariantResponse[];
}

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
    private readonly consents: ConsentService,
  ) {}

  async upload(
    actor: Actor,
    purpose: MediaPurpose,
    file: UploadedFile,
  ): Promise<MediaAssetResponse> {
    if (actor.locked) throw forbidden();
    // Identity papers are only collected after the person consented to the privacy policy (NFR-SEC-07).
    if (purpose === 'CERTIFICATE') await this.consents.require(actor.id, 'ID_DOCUMENT');
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

  /** URL công khai bản WebP phù hợp (gần 1280 px) của các tệp đã xử lý xong, theo id. */
  async publicUrls(ids: readonly string[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>();
    for (const [id, media] of await this.publicMedia(ids)) urls.set(id, media.url);
    return urls;
  }

  /** Like {@link publicUrls}, with every public variant too. */
  async publicMedia(ids: readonly string[]): Promise<Map<string, PublicMedia>> {
    const found = new Map<string, PublicMedia>();
    if (ids.length === 0) return found;
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { id: { $in: [...ids] }, status: 'READY', visibility: 'PUBLIC' });
    for (const asset of assets) {
      const url = this.displayUrl(asset);
      if (url) found.set(asset.id, { url, variants: this.publicVariants(asset) });
    }
    return found;
  }

  /**
   * Credit and sizes of public files, keyed by `sha256`: journal entries store only an image URL and hash,
   * not a file id. Files that are not (yet) public and processed are absent.
   */
  async entryImages(
    checksums: readonly string[],
  ): Promise<Map<string, { credit: MediaCredit | null; variants: MediaVariantResponse[] }>> {
    const found = new Map<
      string,
      { credit: MediaCredit | null; variants: MediaVariantResponse[] }
    >();
    const unique = [...new Set(checksums)];
    if (unique.length === 0) return found;
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { sha256: { $in: unique }, status: 'READY', visibility: 'PUBLIC' });
    for (const asset of assets) {
      found.set(asset.sha256, {
        credit: publicCredit(asset.credit),
        variants: this.publicVariants(asset),
      });
    }
    return found;
  }

  /** Processed public images linked to the targets, keyed by `targetId`, each role ordered by `position`. */
  async linkedImages(
    targetType: MediaLinkTarget,
    targetIds: readonly string[],
    roles: readonly PublicLinkRole[],
  ): Promise<Map<string, LinkedImage[]>> {
    const byTarget = new Map<string, LinkedImage[]>();
    if (targetIds.length === 0) return byTarget;
    const links = await this.orm.em.fork().find(
      MediaLink,
      {
        targetType,
        targetId: { $in: [...targetIds] },
        role: { $in: [...roles] },
        media: { status: 'READY', visibility: 'PUBLIC' },
      },
      { populate: ['media'], orderBy: { position: 'asc' } },
    );
    for (const link of links) {
      const url = this.displayUrl(link.media);
      if (!url) continue;
      const list = byTarget.get(link.targetId) ?? [];
      list.push({
        role: link.role as PublicLinkRole,
        image: {
          mediaId: link.media.id,
          url,
          width: link.media.width ?? null,
          height: link.media.height ?? null,
          variants: this.publicVariants(link.media),
          alt: link.altText ?? link.media.altText ?? '',
          altEn: link.altEn ?? null,
          caption: link.caption ?? null,
          credit: publicCredit(link.media.credit),
        },
      });
      byTarget.set(link.targetId, list);
    }
    return byTarget;
  }

  /**
   * Processed `COVER` images linked to the products that show a `coverUrl`, keyed by product id: the source of the
   * cover's sizes (`coverVariants`). Preset covers match none of them.
   */
  async productCoverImages(products: readonly Product[]): Promise<Map<string, PublicImageDto[]>> {
    const linked = await this.linkedImages(
      'PRODUCT',
      products.filter((p) => p.coverUrl).map((p) => p.id),
      ['COVER'],
    );
    return new Map([...linked].map(([id, items]) => [id, items.map((item) => item.image)]));
  }

  /**
   * Credit for the product cover. Applies only while the cover is still the preset `coverUrl`: uploading
   * photos clears `coverUrl`, but the old `media_link` stays and no longer describes the displayed image.
   */
  async productCoverCredit(product: Product): Promise<MediaCredit | null> {
    if (!product.coverUrl) return null;
    const linked = await this.linkedImages('PRODUCT', [product.id], ['COVER']);
    return linked.get(product.id)?.[0]?.image.credit ?? null;
  }

  /** Những id mà người này tải lên; dùng để chặn gắn ảnh của người khác vào hồ sơ. */
  async ownedBy(ownerId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { id: { $in: [...ids] }, ownerId }, { fields: ['id'] });
    return new Set(assets.map((asset) => asset.id));
  }

  /** Every file the person uploaded, with a link to it (signed and short-lived for private files). */
  async exportOwned(ownerId: string): Promise<ExportedMediaDto[]> {
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { ownerId }, { orderBy: { createdAt: 'asc', id: 'asc' } });
    const items: ExportedMediaDto[] = [];
    for (const asset of assets) {
      let url: string | null = null;
      let urlExpiresAt: string | null = null;
      if (asset.visibility === 'PRIVATE') {
        url = await this.storage.presignGet(asset.originalKey, PRESIGN_TTL_SECONDS);
        urlExpiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000).toISOString();
      } else if (asset.status === 'READY') {
        url = this.displayUrl(asset) ?? null;
      }
      items.push({
        id: asset.id,
        purpose: asset.purpose,
        visibility: asset.visibility,
        status: asset.status,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sha256: asset.sha256,
        createdAt: asset.createdAt.toISOString(),
        url,
        urlExpiresAt,
      });
    }
    return items;
  }

  /** Remove the stored objects of deleted assets. Returns the ids whose files could not be removed. */
  async deleteFiles(assets: readonly MediaAsset[]): Promise<string[]> {
    const failed: string[] = [];
    for (const asset of assets) {
      try {
        await this.storage.delete('private', asset.originalKey);
        for (const variant of asset.variants) await this.storage.delete('public', variant.key);
      } catch {
        failed.push(asset.id);
      }
    }
    return failed;
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

  /** Every public variant, narrowest first (AVIF before WebP at the same width). */
  private publicVariants(asset: MediaAsset): MediaVariantResponse[] {
    return asset.variants
      .map((variant) => ({
        format: variant.format,
        width: variant.width,
        height: variant.height,
        url: this.storage.publicUrl(variant.key),
      }))
      .sort((a, b) => a.width - b.width || a.format.localeCompare(b.format));
  }

  /** The WebP variant closest to 1280 px. */
  private displayUrl(asset: MediaAsset): string | undefined {
    const webp = asset.variants
      .filter((variant) => variant.format === 'webp')
      .sort((a, b) => Math.abs(a.width - 1280) - Math.abs(b.width - 1280))[0];
    return webp && this.storage.publicUrl(webp.key);
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
      variants: published ? this.publicVariants(asset) : [],
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
