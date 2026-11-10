import { createHash } from 'node:crypto';
import {
  AppUser,
  DEMO_PHOTOS,
  deleteMediaAssetRows,
  demoPhotoAssetId,
  findOrphanMediaAssets,
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
  Product,
} from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

const DAY_MS = 86_400_000;
const sha256Of = (name: string) => createHash('sha256').update(name).digest('hex');

/** GH#381: only assets that nothing refers to, and that nobody touched for a week, are swept. */
describe('Orphan media assets', () => {
  let db: TestDatabase;
  const now = new Date();
  const old = new Date(now.getTime() - 8 * DAY_MS);
  const ids: Record<string, string> = {};

  async function asset(name: string, updatedAt: Date, id?: string) {
    const em = db.orm.em.fork();
    const created = em.create(MediaAsset, {
      ...(id ? { id } : {}),
      ownerId: crypto.randomUUID(),
      purpose: 'PRODUCT',
      visibility: 'PUBLIC',
      status: 'READY',
      mimeType: 'image/webp',
      sizeBytes: 1,
      sha256: sha256Of(name),
      originalKey: `originals/${name}`,
      variants: [{ format: 'webp', width: 320, height: 200, key: `v/${name}-320.webp`, bytes: 1 }],
    });
    await em.flush();
    // `updatedAt` is stamped on insert, so age the row explicitly afterwards.
    await em.nativeUpdate(MediaAsset, { id: created.id }, { updatedAt });
    ids[name] = created.id;
    return created.id;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();

    const em = db.orm.em.fork();
    const rep = em.create(AppUser, {
      id: crypto.randomUUID(),
      email: 'orphans@test.local',
      role: 'HOUSEHOLD',
    });
    const coverId = await asset('household-cover', old);
    const household = em.create(Household, {
      name: 'Orphan household',
      slug: 'orphan-household',
      history: '',
      status: 'APPROVED',
      representative: rep,
      coverPhoto: { mediaId: coverId, alt: 'Cover' },
    });
    const product = em.create(Product, {
      household,
      name: 'Orphan product',
      slug: 'orphan-product',
      traceCode: 'ORPH4N01',
      description: 'x',
      kind: 'OBJECT',
      category: 'DECOR',
      priceVnd: 1,
      stock: 1,
      status: 'PUBLISHED',
      publishedAt: now,
      coverUrl: 'https://cdn.test/v/product-cover-320.webp',
    });
    em.create(JournalEntry, {
      product,
      seq: 0,
      stage: 'clay',
      declaredDate: '2026-09-01',
      note: 'x',
      images: [{ sha256: sha256Of('journal-photo') }],
      prevHash: 'GENESIS',
      hash: 'a'.repeat(64),
    });
    await em.flush();

    const linked = await asset('linked', old);
    em.create(MediaLink, {
      media: em.getReference(MediaAsset, linked),
      targetType: 'HOUSEHOLD',
      targetId: household.id,
      role: 'GALLERY',
    });
    await em.flush();
    await asset('journal-photo', old);
    // The product cover is referenced only by the variant key inside its URL.
    await asset('product-cover', old);
    await asset('recent-orphan', new Date(now.getTime() - 2 * DAY_MS));
    await asset('demo-photo', old, demoPhotoAssetId(DEMO_PHOTOS[0]?.id ?? ''));
    await asset('old-orphan', old);
  });

  afterAll(async () => {
    await db?.stop();
  });

  it('selects only the old unreferenced asset', async () => {
    const orphans = await findOrphanMediaAssets(db.orm, { now });
    expect(orphans.map((a) => a.id)).toEqual([ids['old-orphan']]);
    expect(orphans[0]?.variants[0]?.key).toBe('v/old-orphan-320.webp');
  });

  it('respects the exclude list and the batch limit', async () => {
    expect(
      await findOrphanMediaAssets(db.orm, { now, excludeIds: new Set([ids['old-orphan'] ?? '']) }),
    ).toEqual([]);
    expect(await findOrphanMediaAssets(db.orm, { now, limit: 0 })).toEqual([]);
  });

  it('selects the recent orphan once its grace period has passed, then deletes rows', async () => {
    const later = new Date(now.getTime() + 6 * DAY_MS);
    const orphans = await findOrphanMediaAssets(db.orm, { now: later });
    expect(orphans.map((a) => a.id).sort()).toEqual(
      [ids['old-orphan'], ids['recent-orphan']].sort(),
    );
    expect(
      await deleteMediaAssetRows(
        db.orm,
        orphans.map((a) => a.id),
      ),
    ).toBe(2);
    expect(await findOrphanMediaAssets(db.orm, { now: later })).toEqual([]);
    expect(await db.orm.em.fork().count(MediaAsset)).toBe(5);
  });
});
