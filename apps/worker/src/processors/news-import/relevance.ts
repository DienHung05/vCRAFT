import { normalizeSearchText } from '@vcraft/utils';
import type { FeedItem } from './feed';

export interface RelevanceConfig {
  /** Covered villages, e.g. "Bát Tràng". */
  villages: readonly string[];
  /** Craft words, e.g. "gốm", "sứ". */
  crafts: readonly string[];
}

const fold = (text: string) => ` ${normalizeSearchText(text, 20_000)} `;

/** True when the folded text contains the folded phrase as whole words. */
const mentions = (haystack: string, phrase: string) => {
  const needle = normalizeSearchText(phrase, 200);
  return needle.length > 0 && haystack.includes(` ${needle} `);
};

/**
 * Keep only stories that mention a covered village and a craft word in the headline or snippet (accents and
 * case ignored, whole words only). The reason is returned so the run log can say why a story was skipped.
 */
export function relevance(
  item: Pick<FeedItem, 'title' | 'description'>,
  config: RelevanceConfig,
): 'relevant' | 'no-village' | 'no-craft' {
  const text = fold(`${item.title} ${item.description}`);
  if (!config.villages.some((village) => mentions(text, village))) return 'no-village';
  if (!config.crafts.some((craft) => mentions(text, craft))) return 'no-craft';
  return 'relevant';
}
