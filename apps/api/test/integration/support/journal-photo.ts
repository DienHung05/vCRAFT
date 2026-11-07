import { MediaAsset } from '@vcraft/database';
import type { TestApp } from './test-app.js';
import type { TestDatabase } from './test-database.js';

/** A journal photo as the API stores it: the public variant URL plus the original's checksum. */
export interface JournalPhoto {
  url: string;
  sha256: string;
}

/**
 * Creates a READY journal photo (with a WebP variant) owned by `owner` and returns the image the journal
 * endpoints accept: the asset's public variant URL and checksum. Every milestone needs one (FR-PRD-04).
 */
export async function createJournalPhoto(
  db: TestDatabase,
  t: TestApp,
  owner: { id: string; auth: string },
  sha256 = 'a'.repeat(64),
): Promise<JournalPhoto> {
  const em = db.orm.em.fork();
  const photo = em.create(MediaAsset, {
    ownerId: owner.id,
    purpose: 'JOURNAL',
    visibility: 'PUBLIC',
    status: 'READY',
    mimeType: 'image/webp',
    sizeBytes: 1,
    width: 1280,
    height: 800,
    sha256,
    originalKey: `originals/${sha256.slice(0, 8)}`,
    variants: [
      {
        format: 'webp',
        width: 1280,
        height: 800,
        key: `v/${sha256.slice(0, 8)}-1280.webp`,
        bytes: 1,
      },
    ],
  });
  await em.flush();
  const read = await t.request({ method: 'GET', url: `/media/${photo.id}`, auth: owner.auth });
  return { url: read.body.variants[0].url, sha256 };
}

/** Appends one milestone with `photo` to a product's journal (a product cannot publish without one). */
export async function addMilestone(
  t: TestApp,
  owner: { auth: string },
  productId: string,
  photo: JournalPhoto,
  stage = 'clay',
) {
  return t.request({
    method: 'POST',
    url: `/me/household/products/${productId}/journal`,
    auth: owner.auth,
    body: { stage, declaredDate: '2026-09-02', note: 'Lọc đất, ủ ba tuần.', images: [photo] },
  });
}
