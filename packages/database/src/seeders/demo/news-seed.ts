import type { NewsSeed } from './pools.js';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/**
 * The publish moment of a seed story. A story with a real `publishedAt` keeps exactly that date, so the
 * site matches its source (GH#314). Older seed stories fall back to `daysAgo` before the frozen anchor
 * and are spread by `order` so their sort order is stable.
 */
export function newsPublishedAt(item: NewsSeed, order: number, anchor: Date): Date {
  if (item.publishedAt) return new Date(item.publishedAt);
  return new Date(anchor.getTime() - (item.daysAgo ?? 0) * DAY + order * HOUR);
}

/** Fields of a seed story that do not depend on a household, shared by the demo seed and the production swap. */
export function newsSeedFields(item: NewsSeed, order: number, anchor: Date, ownerName = '') {
  const fill = (text: string) => text.replaceAll('{hộ}', ownerName);
  const publishedAt = newsPublishedAt(item, order, anchor);
  return {
    title: fill(item.title),
    summary: fill(item.summary),
    body: fill(item.body),
    category: item.category,
    pinned: item.pinned ?? false,
    publishedAt,
    sourceName: item.sourceName ?? null,
    sourceUrl: item.sourceUrl ?? null,
    sourcePublishedAt: item.sourceName
      ? new Date(item.sourcePublishedAt ?? item.publishedAt ?? publishedAt)
      : null,
  };
}

/**
 * Keys of the 18 invented stories seeded before GH#314. The production swap sets any of them that is no
 * longer in `NEWS` back to draft (never deletes), because their text was made up. A key that is still in
 * `NEWS` is updated instead.
 */
export const LEGACY_NEWS_KEYS: readonly string[] = [
  'village-lantern',
  'village-cooperative',
  'village-trace',
  'village-kiln-safety',
  'village-clay-month',
  'village-spring-fair',
  'h0-blue-glaze',
  'h0-open-kiln',
  'h1-crackle',
  'h2-logo-cup',
  'h2-batch-code',
  'h3-lotus',
  'h4-vase',
  'h5-teaset',
  'h6-altar',
  'h7-class',
  'h8-white-plate',
  'h12-wine-jar',
];
