import type { EntityManager } from '@mikro-orm/core';
import { AppUser, Artisan, Household, News, Product, Workshop } from '../../entities/index.js';
import { DEMO_ACCOUNT_LIST } from './accounts.js';
import { artisanBio, householdStory } from './demo-text.js';
import { HOUSEHOLDS, type HouseholdSeed, NEWS, PENDING_HOUSEHOLD } from './pools.js';

/**
 * Rewrites the text of a demo database that was seeded before GH#204 and GH#298: the old "sample data"
 * disclaimers go away and the household stories and artisan bios become the current seed text. Only text
 * columns are written; media, users, ids and slugs are never touched. Idempotent: a row whose text already
 * matches is left alone, so a second run reports nothing changed.
 */

export interface RefreshTextOptions {
  /** Compute and report the changes but write nothing. */
  readonly dryRun?: boolean;
}

export interface RefreshTableCounts {
  readonly changed: number;
  readonly unchanged: number;
}

export interface RefreshTextReport {
  readonly dryRun: boolean;
  readonly household: RefreshTableCounts;
  readonly artisan: RefreshTableCounts;
  readonly news: RefreshTableCounts;
  readonly product: RefreshTableCounts;
  readonly appUser: RefreshTableCounts;
  /** Slugs of the households whose text changed (never any text itself). */
  readonly changedHouseholdSlugs: readonly string[];
}

/** Marker of the old disclaimer sentences. */
const DISCLAIMER_SENTENCE =
  /hư\s+cấu|không\s+phải\s+hộ\s+thật|dùng\s+để\s+trình\s+diễn|dữ\s+liệu\s+mẫu/i;
/** The tag the demo account names used to end with. */
const SAMPLE_NAME_SUFFIX = /\s*\(mẫu\)\s*$/i;
const LEADING_TAG = /^\s*\[\s*dữ\s+liệu\s+mẫu\s*\]\s*/i;

/**
 * Removes the old demo disclaimers from a text: a leading `[Dữ liệu mẫu]` tag (any case or spacing) and every
 * sentence that says the data is fictional or for demonstration. Line breaks are kept. Idempotent.
 */
export function stripDemoDisclaimer(text: string): string {
  const lines = text.replace(LEADING_TAG, '').split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    const sentences = line.split(/(?<=[.!?…])\s+/).filter((s) => !DISCLAIMER_SENTENCE.test(s));
    const rebuilt = sentences.join(' ').trim();
    // A line that only held a disclaimer disappears; a line that was blank on purpose stays blank.
    if (rebuilt !== '' || line.trim() === '') kept.push(rebuilt);
  }
  return kept.join('\n').trim();
}

/** Seed households by name: the 20 approved ones plus the pending one. */
function seedByName(): ReadonlyMap<string, HouseholdSeed> {
  return new Map([...HOUSEHOLDS, PENDING_HOUSEHOLD].map((seed) => [seed.name, seed]));
}

/** Address used when a seeded household has no workshop row (the seed gives every household one). */
const FALLBACK_ADDRESS = 'Bát Tràng, Gia Lâm';

/** Title (with the household name filled in) mapped to the seed body of every pooled news item. */
function seedNewsBodies(): ReadonlyMap<string, string> {
  const bodies = new Map<string, string>();
  for (const item of NEWS) {
    const ownerName = item.h === null ? '' : (HOUSEHOLDS[item.h]?.name ?? '');
    bodies.set(item.title.replaceAll('{hộ}', ownerName), item.body.replaceAll('{hộ}', ownerName));
  }
  return bodies;
}

class Tally {
  changed = 0;
  unchanged = 0;
  count(didChange: boolean): void {
    if (didChange) this.changed++;
    else this.unchanged++;
  }
  get counts(): RefreshTableCounts {
    return { changed: this.changed, unchanged: this.unchanged };
  }
}

export async function refreshDemoText(
  em: EntityManager,
  options: RefreshTextOptions = {},
): Promise<RefreshTextReport> {
  const dryRun = options.dryRun === true;
  const seeds = seedByName();
  const newsBodies = seedNewsBodies();
  const tallies = {
    household: new Tally(),
    artisan: new Tally(),
    news: new Tally(),
    product: new Tally(),
    appUser: new Tally(),
  };
  const changedHouseholdSlugs: string[] = [];

  await em.transactional(async (tx) => {
    // Assign a new value only on a real run; a dry run only compares.
    const apply = <T extends object, K extends keyof T>(
      entity: T,
      key: K,
      value: T[K],
    ): boolean => {
      if (entity[key] === value) return false;
      if (!dryRun) entity[key] = value;
      return true;
    };
    // For a required column: never blank it, even when a disclaimer was the only text.
    const stripped = (value: string): string => stripDemoDisclaimer(value) || value;

    const households = await tx.find(Household, {}, { orderBy: { createdAt: 'asc', id: 'asc' } });
    const workshops = await tx.find(Workshop, {}, { orderBy: { createdAt: 'asc', id: 'asc' } });
    const artisans = await tx.find(Artisan, {}, { orderBy: { createdAt: 'asc', id: 'asc' } });

    const firstAddress = new Map<string, string>();
    for (const workshop of workshops) {
      if (!firstAddress.has(workshop.household.id)) {
        firstAddress.set(workshop.household.id, workshop.address);
      }
    }
    const artisansByHousehold = new Map<string, Artisan[]>();
    for (const artisan of artisans) {
      const list = artisansByHousehold.get(artisan.household.id) ?? [];
      list.push(artisan);
      artisansByHousehold.set(artisan.household.id, list);
    }

    for (const household of households) {
      const seed = seeds.get(household.name);
      const history = seed
        ? householdStory(seed, firstAddress.get(household.id) ?? FALLBACK_ADDRESS)
        : stripped(household.history);
      const changed = apply(household, 'history', history);
      tallies.household.count(changed);
      if (changed) changedHouseholdSlugs.push(household.slug);

      for (const [position, artisan] of (artisansByHousehold.get(household.id) ?? []).entries()) {
        const bio = seed
          ? artisanBio({
              household: seed,
              artisanName: artisan.name,
              position,
              craftRole: artisan.craftRole ?? '',
            })
          : artisan.bio == null
            ? artisan.bio
            : stripDemoDisclaimer(artisan.bio);
        tallies.artisan.count(apply(artisan, 'bio', bio));
      }
    }

    const newsRows = await tx.find(News, {});
    for (const news of newsRows) {
      const seedBody = newsBodies.get(news.title);
      let changed = apply(news, 'body', seedBody ?? stripped(news.body));
      changed = apply(news, 'title', stripped(news.title)) || changed;
      changed = apply(news, 'summary', stripped(news.summary)) || changed;
      tallies.news.count(changed);
    }

    // Account names lose the old " (mẫu)" tag. The four fixed demo accounts get their current seed name; any
    // other account (the representatives of the seeded households) only loses the suffix.
    const seedNames = new Map(DEMO_ACCOUNT_LIST.map((account) => [account.id, account.fullName]));
    const users = await tx.find(AppUser, {});
    for (const user of users) {
      const current = user.fullName;
      if (current == null || !SAMPLE_NAME_SUFFIX.test(current)) {
        tallies.appUser.count(false);
        continue;
      }
      const next = seedNames.get(user.id) ?? current.replace(SAMPLE_NAME_SUFFIX, '').trim();
      tallies.appUser.count(apply(user, 'fullName', next || current));
    }

    const products = await tx.find(Product, {});
    for (const product of products) {
      let changed = apply(product, 'description', stripped(product.description));
      if (product.artisanNote != null) {
        changed =
          apply(product, 'artisanNote', stripDemoDisclaimer(product.artisanNote)) || changed;
      }
      tallies.product.count(changed);
    }
  });

  return {
    dryRun,
    household: tallies.household.counts,
    artisan: tallies.artisan.counts,
    news: tallies.news.counts,
    product: tallies.product.counts,
    appUser: tallies.appUser.counts,
    changedHouseholdSlugs,
  };
}
