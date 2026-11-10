import type { EntityManager, MikroORM } from '@mikro-orm/core';
import { AppUser } from '../entities/app-user.entity.js';
import { Household } from '../entities/household.entity.js';
import { JournalEntry } from '../entities/journal-entry.entity.js';
import { MediaAsset } from '../entities/media-asset.entity.js';
import { MediaLink } from '../entities/media-link.entity.js';
import { OrderAllocation } from '../entities/order-allocation.entity.js';
import { Product } from '../entities/product.entity.js';
import { demoDocumentAssetId, demoPhotoAssetId } from '../seeders/demo/link-media.js';
import { DEMO_PHOTOS } from '../seeders/demo/photo-manifest.js';
import { DEMO_VERIFICATION_DOCS } from '../seeders/demo/verification-docs.js';

/** An unreferenced asset is only swept once it has been untouched for this long (GH#381). */
export const MEDIA_ORPHAN_GRACE_DAYS = 7;
/** Orphans handled per batch by the worker sweep. */
export const MEDIA_ORPHAN_BATCH_SIZE = 100;

const CANDIDATE_PAGE_SIZE = 200;

/** Everything that can point at an asset other than a `media_link` row. */
export interface MediaReferences {
  /** Asset ids named by `mediaId` inside household and product JSON columns. */
  ids: Set<string>;
  /** Content hashes named by production journal images (the hash chain must keep resolving). */
  sha256: Set<string>;
  /** All stored URL strings (covers, journal images, progress photos) joined by newlines. */
  urls: string;
}

/** Ids of the demo photos and specimen documents: `pnpm demo:media` owns them, so the sweep never touches them. */
export function demoMediaAssetIds(): Set<string> {
  return new Set([
    ...DEMO_PHOTOS.map((photo) => demoPhotoAssetId(photo.id)),
    ...DEMO_VERIFICATION_DOCS.map((doc) => demoDocumentAssetId(doc.id)),
  ]);
}

/** Collects `mediaId` values from any parsed JSON value (households and products nest them in several shapes). */
function collectMediaIds(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, into);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'mediaId' && typeof item === 'string') into.add(item);
      else collectMediaIds(item, into);
    }
  }
}

/** Loads every non-`media_link` reference to an asset. Run once per sweep; the tables involved are small. */
export async function collectMediaReferences(em: EntityManager): Promise<MediaReferences> {
  const ids = new Set<string>();
  const sha256 = new Set<string>();
  const urls: string[] = [];

  const households = await em.find(
    Household,
    {},
    {
      fields: [
        'coverPhoto',
        'portraitPhoto',
        'sealPhoto',
        'coverUrl',
        'timeline',
        'certifications',
        'gallery',
      ],
    },
  );
  for (const household of households) {
    collectMediaIds(
      [
        household.coverPhoto,
        household.portraitPhoto,
        household.sealPhoto,
        household.timeline,
        household.certifications,
        household.gallery,
      ],
      ids,
    );
    if (household.coverUrl) urls.push(household.coverUrl);
    for (const item of household.gallery ?? []) if (item.url) urls.push(item.url);
  }

  for (const product of await em.find(Product, {}, { fields: ['images', 'coverUrl'] })) {
    collectMediaIds(product.images, ids);
    if (product.coverUrl) urls.push(product.coverUrl);
  }

  for (const entry of await em.find(JournalEntry, {}, { fields: ['images'] })) {
    for (const image of entry.images ?? []) {
      sha256.add(image.sha256);
      if (image.url) urls.push(image.url);
    }
  }

  for (const allocation of await em.find(OrderAllocation, {}, { fields: ['progressLog'] })) {
    for (const report of allocation.progressLog ?? [])
      if (report.photoUrl) urls.push(report.photoUrl);
  }

  return { ids, sha256, urls: urls.join('\n') };
}

/** Variant keys embed the asset id (`v/<assetId>/...`), so a stored URL names its asset. */
function isReferenced(asset: MediaAsset, refs: MediaReferences): boolean {
  return (
    refs.ids.has(asset.id) ||
    (asset.visibility === 'PUBLIC' && refs.sha256.has(asset.sha256)) ||
    refs.urls.includes(`v/${asset.id}/`) ||
    asset.variants.some((variant) => refs.urls.includes(variant.key)) ||
    (asset.originalKey !== '' && refs.urls.includes(asset.originalKey))
  );
}

export interface FindOrphansOptions {
  now?: Date;
  limit?: number;
  /** Assets to ignore (for example ones whose files could not be removed earlier in the same run). */
  excludeIds?: ReadonlySet<string>;
}

/**
 * Assets nothing refers to: no `media_link` row, no `mediaId`/URL/hash in household, product, journal or progress
 * data, not a demo asset, not a CERTIFICATE document of an existing owner, and not touched for {@link MEDIA_ORPHAN_GRACE_DAYS} days. The grace period runs from
 * `updatedAt` (stamped on upload and again when the worker marks the file READY), so a file uploaded during a form
 * fill is never swept before the form has had a week to link it. Oldest first, at most `limit`.
 */
export async function findOrphanMediaAssets(
  orm: MikroORM,
  options: FindOrphansOptions = {},
): Promise<MediaAsset[]> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? MEDIA_ORPHAN_BATCH_SIZE;
  const cutoff = new Date(now.getTime() - MEDIA_ORPHAN_GRACE_DAYS * 86_400_000);
  const skip = demoMediaAssetIds();
  for (const id of options.excludeIds ?? []) skip.add(id);

  const em = orm.em.fork();
  const refs = await collectMediaReferences(em);
  const orphans: MediaAsset[] = [];
  let cursor: string | null = null;
  while (orphans.length < limit) {
    const page: MediaAsset[] = await em.find(
      MediaAsset,
      { updatedAt: { $lt: cutoff }, ...(cursor ? { id: { $gt: cursor } } : {}) },
      { orderBy: { id: 'asc' }, limit: CANDIDATE_PAGE_SIZE },
    );
    if (page.length === 0) break;
    cursor = page[page.length - 1]?.id ?? null;
    const linked = new Set(
      (
        await em.find(
          MediaLink,
          { media: { $in: page.map((asset) => asset.id) } },
          { fields: ['media'] },
        )
      ).map((link) => link.media.id),
    );
    // CERTIFICATE documents never get a media_link: they are found by (ownerId, purpose) for as long as the
    // owner exists (household approval reads them that way), so they are never orphans while it does (GH#456).
    // RFQ_ATTACHMENT is always linked via media_link; JOURNAL and PRODUCT are found by id, hash or URL above.
    const certificateOwners = [
      ...new Set(page.filter((a) => a.purpose === 'CERTIFICATE').map((a) => a.ownerId)),
    ];
    const liveOwners = new Set(
      certificateOwners.length > 0
        ? (await em.find(AppUser, { id: { $in: certificateOwners } }, { fields: ['id'] })).map(
            (user) => user.id,
          )
        : [],
    );
    for (const asset of page) {
      if (orphans.length >= limit) break;
      if (asset.purpose === 'CERTIFICATE' && liveOwners.has(asset.ownerId)) continue;
      if (skip.has(asset.id) || linked.has(asset.id) || isReferenced(asset, refs)) continue;
      orphans.push(asset);
    }
    if (page.length < CANDIDATE_PAGE_SIZE) break;
  }
  return orphans;
}

/** Deletes the rows of swept assets once their files are gone. Returns how many rows went. */
export async function deleteMediaAssetRows(orm: MikroORM, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  return orm.em.fork().nativeDelete(MediaAsset, { id: { $in: [...ids] } });
}
