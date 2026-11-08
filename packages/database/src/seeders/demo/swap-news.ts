import type { EntityManager } from '@mikro-orm/core';
import { slugify } from '@vcraft/utils';
import { Household, type MediaAsset, MediaLink, News } from '../../entities/index.js';
import { queueKnowledgeChange } from '../../repositories/knowledge-events.js';
import { demoPhotoAssetId, loadAssets } from './link-media.js';
import { LEGACY_NEWS_KEYS, newsSeedFields } from './news-seed.js';
import { DEMO_PHOTO_LINKS } from './photo-manifest.js';
import { HOUSEHOLDS, NEWS } from './pools.js';
import { demoEntityId, FROZEN_ANCHOR } from './seed-demo.js';

export interface SwapNewsSummary {
  created: number;
  updated: number;
  unchanged: number;
  /** Seed stories skipped because their household does not exist in the target database. */
  skippedNoHousehold: number;
  /** Legacy invented stories set back to draft. */
  retired: number;
  coversCreated: number;
  coversUpdated: number;
  dryRun: boolean;
}

/** Sentinel used to roll the transaction back after a dry run. */
class DryRunDone extends Error {
  constructor(readonly summary: SwapNewsSummary) {
    super('dry run');
  }
}

const sameValue = (before: unknown, value: unknown): boolean =>
  before instanceof Date && value instanceof Date
    ? before.getTime() === value.getTime()
    : (before ?? null) === (value ?? null);

/**
 * Production swap of the seed news (GH#314). Idempotent and non-destructive: keyed on the stable story ids
 * (UUID v5 of the seed key), it creates or updates the `news` rows of `NEWS` (text, dates, source) and links
 * their covers from the photo manifest, and it sets the legacy invented stories back to draft. It never
 * deletes a row and touches no table except `news`, `media_link` (news covers only) and the outbox event
 * that tells the assistant to reindex. The cover files must already exist (`pnpm demo:media --only=media`).
 */
export async function swapDemoNews(
  em: EntityManager,
  options: { dryRun?: boolean } = {},
): Promise<SwapNewsSummary> {
  const summary: SwapNewsSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedNoHousehold: 0,
    retired: 0,
    coversCreated: 0,
    coversUpdated: 0,
    dryRun: options.dryRun === true,
  };
  try {
    await em.transactional(async (tx) => {
      const householdBySlug = new Map(
        (await tx.find(Household, {})).map((household) => [household.slug, household]),
      );
      const keys = new Set(NEWS.map((item) => item.key));
      const present = new Set<string>();

      for (const [order, item] of NEWS.entries()) {
        const seed = item.h === null ? undefined : HOUSEHOLDS[item.h];
        const owner = seed ? (householdBySlug.get(slugify(seed.name)) ?? null) : null;
        if (item.h !== null && !owner) {
          summary.skippedNoHousehold++;
          continue;
        }
        const fields = newsSeedFields(item, order, FROZEN_ANCHOR, owner?.name ?? '');
        const id = demoEntityId('news', item.key);
        present.add(id);
        const existing = await tx.findOne(News, id, { populate: ['household'] });
        if (!existing) {
          const wanted = slugify(fields.title);
          const clash = await tx.findOne(News, { slug: wanted }, { fields: ['id'] });
          tx.create(News, {
            ...fields,
            id,
            slug: clash ? `${wanted}-${item.key}` : wanted,
            household: owner,
            status: 'PUBLISHED',
            createdAt: fields.publishedAt,
            updatedAt: fields.publishedAt,
          });
          queueKnowledgeChange(tx, 'NEWS', id);
          summary.created++;
          continue;
        }
        let changed = false;
        for (const [key, value] of Object.entries(fields)) {
          if (sameValue(existing[key as keyof News], value)) continue;
          (existing as unknown as Record<string, unknown>)[key] = value;
          changed = true;
        }
        if ((existing.household?.id ?? null) !== (owner?.id ?? null)) {
          existing.household = owner;
          changed = true;
        }
        if (existing.status !== 'PUBLISHED') {
          existing.status = 'PUBLISHED';
          changed = true;
        }
        if (changed) {
          queueKnowledgeChange(tx, 'NEWS', id);
          summary.updated++;
        } else summary.unchanged++;
      }

      // Invented stories of the old seed that no longer exist in the pool: unpublish, never delete.
      const retiredIds = LEGACY_NEWS_KEYS.filter((key) => !keys.has(key)).map((key) =>
        demoEntityId('news', key),
      );
      for (const story of await tx.find(News, { id: { $in: retiredIds }, status: 'PUBLISHED' })) {
        story.status = 'DRAFT';
        story.publishedAt = null;
        queueKnowledgeChange(tx, 'NEWS', story.id);
        summary.retired++;
      }
      await tx.flush();

      // Covers: only the news slots of the photo manifest.
      const covers = DEMO_PHOTO_LINKS.filter(
        (link) => link.target === 'NEWS' && present.has(demoEntityId('news', link.key)),
      );
      const assets = await loadAssets(
        tx,
        new Map(
          [...new Set(covers.map((link) => link.photo))].map((photo) => [
            photo,
            demoPhotoAssetId(photo),
          ]),
        ),
        'ảnh',
      );
      for (const link of covers) {
        const media = assets.get(link.photo) as MediaAsset;
        const slot = {
          targetType: 'NEWS' as const,
          targetId: demoEntityId('news', link.key),
          role: link.role,
          position: link.position,
        };
        const have = await tx.findOne(MediaLink, slot, { populate: ['media'] });
        if (!have) {
          tx.create(MediaLink, {
            ...slot,
            media,
            altText: link.alt,
            altEn: link.altEn,
            caption: link.caption ?? null,
          });
          summary.coversCreated++;
        } else if (
          have.media.id !== media.id ||
          (have.altText ?? null) !== link.alt ||
          (have.altEn ?? null) !== link.altEn ||
          (have.caption ?? null) !== (link.caption ?? null)
        ) {
          have.media = media;
          have.altText = link.alt;
          have.altEn = link.altEn;
          have.caption = link.caption ?? null;
          summary.coversUpdated++;
        }
      }
      await tx.flush();
      if (options.dryRun) throw new DryRunDone(summary);
    });
  } catch (error) {
    if (error instanceof DryRunDone) return error.summary;
    throw error;
  }
  return summary;
}
