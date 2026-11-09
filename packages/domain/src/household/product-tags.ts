/** FR-PRD-01: a product carries up to 10 free-text tags, each 1 to 30 characters. */
export const MAX_PRODUCT_TAGS = 10;
export const MAX_PRODUCT_TAG_LENGTH = 30;

/** Comparison key of a tag: case-insensitive; diacritics are kept so "gốm" and "gom" stay distinct. */
export function tagKey(tag: string): string {
  return tag.toLocaleLowerCase('vi');
}

/**
 * Cleans a tag list: trims, collapses inner whitespace, drops empty tags and tags that are too long,
 * removes duplicates that differ only by case (the first spelling wins, diacritics are kept for display)
 * and keeps at most `limit` tags (default `MAX_PRODUCT_TAGS`).
 */
export function normalizeTags(tags: readonly string[], limit = MAX_PRODUCT_TAGS): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (tag.length === 0 || tag.length > MAX_PRODUCT_TAG_LENGTH) continue;
    const key = tagKey(tag);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= limit) break;
  }
  return result;
}
