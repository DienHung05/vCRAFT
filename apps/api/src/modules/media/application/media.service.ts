import { createHash } from 'node:crypto';
import { MikroORM } from '@mikro-orm/core';
import { Inject, Injectable } from '@nestjs/common';
import type {
  ExportedMediaDto,
  LiveEvent,
  MediaAssetResponse,
  MediaReadUrlResponse,
  MediaVariantResponse,
  PublicImageDto,
} from '@vcraft/contracts';
import { publicCredit } from '@vcraft/contracts';
import {
  Household,
  MediaAsset,
  type MediaCredit,
  MediaLink,
  type MediaLinkRole,
  type MediaLinkTarget,
  News,
  OutboxEvent,
  type Product,
  QuotationRequest,
} from '@vcraft/database';
import {
  type CertificateKind,
  checkMediaUpload,
  type MediaPurpose,
  readImageSize,
} from '@vcraft/domain';
import { LocalObjectStorage, type ObjectStorage, PRESIGN_TTL_SECONDS } from '@vcraft/storage';
import { fileTypeFromBuffer } from 'file-type';
import type { Actor } from '../../../common/auth/auth.guard';
import { unwrap } from '../../../common/domain/unwrap';
import { forbidden, notFound } from '../../../common/errors/app-error';
import { OBJECT_STORAGE } from '../../../infrastructure/storage/storage.module';
import { ConsentService } from '../../privacy/application/consent.service';

/** Sự kiện outbox để worker chuyển đổi ảnh (ARCHITECTURE §7.1). */
export const MEDIA_UPLOADED_EVENT = 'media.uploaded';

/** A PROCESSING asset untouched for this long is treated as stuck and re-enqueued on re-upload (GH#345). */
export const MEDIA_PROCESSING_STALE_MS = 10 * 60_000;

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
  thumbhash: string | null;
}

/** What a journal entry shows of one of its photos (see {@link MediaService.entryImages}). */
export interface EntryImage {
  mediaId: string;
  status: 'PROCESSING' | 'READY' | 'FAILED';
  /** The ~1280 px WebP; null until the photo is `READY`. */
  url: string | null;
  thumbhash: string | null;
  credit: MediaCredit | null;
  variants: MediaVariantResponse[];
  /** Vietnamese description of the picture (`media_asset.alt_text`), when it has one. */
  alt: string | null;
}

/** The `media.updated` live event (see `LiveEventSchema`). */
export type MediaUpdatedEvent = Extract<LiveEvent, { type: 'media.updated' }>;

/** How far back the first live check looks, and how far behind the newest row later ones stay. */
const LIVE_REPLAY_MS = 60_000;
const LIVE_CLOCK_SKEW_MS = 5_000;

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
    kind?: CertificateKind,
  ): Promise<MediaAssetResponse> {
    if (actor.locked) throw forbidden();
    // A buyer has no profile or catalogue to illustrate: only request attachments (FR-RFQ-01).
    if (actor.role === 'BUYER' && purpose !== 'RFQ_ATTACHMENT') throw forbidden();
    // Identity papers are only collected after the person consented to the privacy policy (NFR-SEC-07).
    if (purpose === 'CERTIFICATE') await this.consents.require(actor.id, 'ID_DOCUMENT');
    // vCRAFT-8my.3: only a private CERTIFICATE document is classified; other purposes ignore `kind`
    // and store UNKNOWN, so JOURNAL/PRODUCT/RFQ uploads keep their old behaviour.
    const certificateKind =
      purpose === 'CERTIFICATE' && kind !== undefined ? kind : ('UNKNOWN' as const);
    const sniffed = await fileTypeFromBuffer(file.bytes);
    const plan = unwrap(
      checkMediaUpload({
        purpose,
        declaredMime: file.declaredMime,
        sniffedMime: sniffed?.mime,
        sizeBytes: file.bytes.byteLength,
        // Header-only read: a huge image is refused here instead of failing in the worker minutes later.
        dimensions: readImageSize(file.bytes),
      }),
    );
    const sha256 = createHash('sha256').update(file.bytes).digest('hex');

    // FR-MEDIA-05: cùng người, cùng mục đích, cùng nội dung ⇒ dùng lại tệp cũ. The dedupe key stays
    // (ownerId, purpose, sha256), so classification never duplicates a binary asset. When a previous
    // upload is reused: an UNKNOWN (legacy) private certificate is upgraded to the kind the owner just
    // picked; a stored known kind wins over a differing request — the client reads the returned kind
    // instead of assuming the upload succeeded with the requested one (vCRAFT-8my.3).
    const em = this.orm.em.fork();
    const existing = await em.findOne(MediaAsset, {
      ownerId: actor.id,
      purpose,
      sha256,
      status: { $ne: 'FAILED' },
    });
    if (existing) {
      // GH#345: a PROCESSING asset that outlived the worker's retries is stuck, so re-uploading the
      // same file re-enqueues it (bumping `updatedAt` restarts the window) instead of returning it.
      if (
        existing.status === 'PROCESSING' &&
        existing.visibility === 'PUBLIC' &&
        Date.now() - existing.updatedAt.getTime() > MEDIA_PROCESSING_STALE_MS
      ) {
        existing.updatedAt = new Date();
        em.create(OutboxEvent, {
          type: MEDIA_UPLOADED_EVENT,
          payload: { assetId: existing.id },
        });
        await em.flush();
      }
      if (
        purpose === 'CERTIFICATE' &&
        existing.certificateKind === 'UNKNOWN' &&
        certificateKind !== 'UNKNOWN'
      ) {
        existing.certificateKind = certificateKind;
        await em.flush();
      }
      return this.toResponse(existing);
    }

    return this.orm.em.fork().transactional(async (em) => {
      const asset = em.create(MediaAsset, {
        ownerId: actor.id,
        purpose,
        certificateKind,
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

  /**
   * Credits of the licensed photos used by published news (GH#314), one per source file. Photos from the
   * automatic import are credited here because they are not in the web app's static credit list.
   */
  async newsCredits(): Promise<MediaCredit[]> {
    const em = this.orm.em.fork();
    const news = await em.find(
      News,
      { status: 'PUBLISHED', publishedAt: { $lte: new Date() } },
      { fields: ['id'], limit: 1000 },
    );
    if (news.length === 0) return [];
    const links = await em.find(
      MediaLink,
      { targetType: 'NEWS', targetId: { $in: news.map((n) => n.id) } },
      { populate: ['media'] },
    );
    const byTitle = new Map<string, MediaCredit>();
    for (const link of links) {
      const credit = publicCredit(link.media.credit);
      if (credit && link.media.status === 'READY' && link.media.visibility === 'PUBLIC')
        byTitle.set(credit.title, credit);
    }
    return [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
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
      if (url)
        found.set(asset.id, {
          url,
          variants: this.publicVariants(asset),
          thumbhash: asset.thumbhash ?? null,
        });
    }
    return found;
  }

  /**
   * The public file behind each journal photo, keyed by `sha256`: journal entries store only the checksum (and,
   * for older entries, an image URL), not a file id. A photo still `PROCESSING` or `FAILED` is reported with its
   * status and no sizes, so a journal saved before the worker finished never breaks (GH#252). When several files
   * share a checksum, a `READY` one wins.
   */
  async entryImages(checksums: readonly string[]): Promise<Map<string, EntryImage>> {
    const found = new Map<string, EntryImage>();
    const unique = [...new Set(checksums)];
    if (unique.length === 0) return found;
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { sha256: { $in: unique }, visibility: 'PUBLIC' });
    const rank: Record<string, number> = { READY: 0, PROCESSING: 1, FAILED: 2 };
    assets.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3));
    for (const asset of assets) {
      if (found.has(asset.sha256)) continue;
      const ready = asset.status === 'READY';
      found.set(asset.sha256, {
        mediaId: asset.id,
        status: asset.status as EntryImage['status'],
        url: ready ? (this.displayUrl(asset) ?? null) : null,
        thumbhash: asset.thumbhash ?? null,
        credit: publicCredit(asset.credit),
        variants: ready ? this.publicVariants(asset) : [],
        alt: asset.altText?.trim() || null,
      });
    }
    return found;
  }

  /**
   * Live `media.updated` events for the person's public photos (GH#252). Each call returns the photos that
   * turned `READY` or `FAILED` since the last one, once each. The first call also replays the last minute, so a
   * photo finished while the stream was reconnecting (every ~25 s) is not missed.
   */
  liveUpdates(ownerId: string, now: () => number = Date.now): () => Promise<MediaUpdatedEvent[]> {
    const sent = new Set<string>();
    let since = now() - LIVE_REPLAY_MS;
    return async () => {
      const assets = await this.orm.em.fork().find(
        MediaAsset,
        {
          ownerId,
          visibility: 'PUBLIC',
          status: { $in: ['READY', 'FAILED'] },
          updatedAt: { $gte: new Date(since) },
        },
        { orderBy: { updatedAt: 'asc' }, limit: 50 },
      );
      const events: MediaUpdatedEvent[] = [];
      for (const asset of assets) {
        const key = `${asset.id}:${asset.status}`;
        if (sent.has(key)) continue;
        sent.add(key);
        events.push(this.toUpdatedEvent(asset));
      }
      // Stay a little behind the newest row seen: the worker's clock may trail the API's.
      const newest = assets.at(-1)?.updatedAt.getTime();
      since = Math.max(since, (newest ?? now()) - LIVE_CLOCK_SKEW_MS);
      return events;
    };
  }

  private toUpdatedEvent(asset: MediaAsset): MediaUpdatedEvent {
    const ready = asset.status === 'READY';
    return {
      type: 'media.updated',
      id: asset.id,
      status: ready ? 'READY' : 'FAILED',
      url: ready ? (this.displayUrl(asset) ?? null) : null,
      variants: ready ? this.publicVariants(asset) : [],
      thumbhash: ready ? (asset.thumbhash ?? null) : null,
      width: asset.width ?? null,
      height: asset.height ?? null,
    };
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

  /** Những id mà người này tải lên; dùng để chặn gắn ảnh của người khác vào hồ sơ. */
  async ownedBy(ownerId: string, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const assets = await this.orm.em
      .fork()
      .find(MediaAsset, { id: { $in: [...ids] }, ownerId }, { fields: ['id'] });
    return new Set(assets.map((asset) => asset.id));
  }

  /**
   * GH#237: every journal photo must be one of the person's own public uploads, named by its checksum, so the
   * hash chain never covers a made-up checksum or someone else's file. A photo still `PROCESSING` is accepted
   * (GH#252: the worker can take minutes, and the journal shows a placeholder until it is `READY`); a `FAILED`
   * one is not. A `url`, when given, must be one of the photo's public variants.
   */
  async ownsJournalImages(
    ownerId: string,
    images: readonly { url?: string | undefined; sha256: string }[],
  ): Promise<boolean> {
    if (images.length === 0) return true;
    const assets = await this.orm.em.fork().find(MediaAsset, {
      ownerId,
      visibility: 'PUBLIC',
      status: { $in: ['READY', 'PROCESSING'] },
      sha256: { $in: [...new Set(images.map((image) => image.sha256))] },
    });
    return images.every((image) =>
      assets.some(
        (asset) =>
          asset.sha256 === image.sha256 &&
          (image.url === undefined ||
            this.publicVariants(asset).some((variant) => variant.url === image.url)),
      ),
    );
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
        certificateKind: asset.certificateKind ?? 'UNKNOWN',
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

  /**
   * Người tải lên hoặc Ban quản lý; người khác nhận 404 để không lộ sự tồn tại của tệp. Tệp đính kèm của một
   * yêu cầu báo giá còn đọc được bởi đại diện các hộ được mời khi yêu cầu đã gửi đi (FR-RFQ-01).
   */
  private async readable(actor: Actor, id: string): Promise<MediaAsset> {
    const em = this.orm.em.fork();
    const asset = await em.findOne(MediaAsset, id);
    if (!asset) throw notFound();
    if (asset.ownerId === actor.id || actor.role === 'ADMIN') return asset;
    if (asset.purpose === 'RFQ_ATTACHMENT' && actor.role === 'HOUSEHOLD') {
      // A file can be linked to several requests (e.g. a draft and a sent one): any readable link grants access.
      const links = await em.find(MediaLink, { media: asset, targetType: 'RFQ' });
      const household = links.length
        ? await em.findOne(Household, { representative: actor.id })
        : null;
      const requests = household
        ? await em.find(QuotationRequest, { id: { $in: links.map((link) => link.targetId) } })
        : [];
      if (
        household &&
        requests.some(
          (request) =>
            request.status !== 'DRAFT' && request.invitedHouseholdIds.includes(household.id),
        )
      )
        return asset;
    }
    throw notFound();
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
      certificateKind: asset.certificateKind ?? 'UNKNOWN',
      variants: published ? this.publicVariants(asset) : [],
      createdAt: asset.createdAt.toISOString(),
    };
  }
}
