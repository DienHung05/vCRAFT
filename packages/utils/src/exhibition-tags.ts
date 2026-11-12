/**
 * Data Cache tags of the public exhibition reads (ADR-0027). The web tags its cached API reads with
 * them; the API/worker send the same tags to `POST /api/revalidate` when a change commits. One
 * definition keeps both sides in step.
 *
 * - `exhibition`: every public exhibition read (lists, details, trace, map, stats). Used for any change
 *   that can alter a list card, a visibility or a map pin.
 * - `household:<slug>`, `product:<slug>`, `trace:<CODE>`: one detail read, for entry-level changes.
 */
export const EXHIBITION_TAG = 'exhibition';

/** The only shapes `POST /api/revalidate` accepts. */
export const EXHIBITION_TAG_PATTERN =
  /^(exhibition|household:[a-z0-9-]+|product:[a-z0-9-]+|trace:[A-Z0-9]+)$/;

/** Most tags one revalidate call may carry. */
export const MAX_REVALIDATE_TAGS = 50;

export function isExhibitionTag(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 200 && EXHIBITION_TAG_PATTERN.test(value);
}

/** `household:<slug>`; null when the slug is not a plain slug (then only the broad tag applies). */
export function householdTag(slug: string): string | null {
  const tag = `household:${slug}`;
  return isExhibitionTag(tag) ? tag : null;
}

export function productTag(slug: string): string | null {
  const tag = `product:${slug}`;
  return isExhibitionTag(tag) ? tag : null;
}

/** `trace:<CODE>`; the code is upper-cased first, as the API does. */
export function traceTag(code: string): string | null {
  const tag = `trace:${code.toUpperCase()}`;
  return isExhibitionTag(tag) ? tag : null;
}

/**
 * Valid, de-duplicated tags, at most {@link MAX_REVALIDATE_TAGS}. Anything dropped (invalid, or over the
 * cap) is replaced by the broad `exhibition` tag, so a change is never under-invalidated.
 */
export function normalizeExhibitionTags(tags: Iterable<string | null | undefined>): string[] {
  const out = new Set<string>();
  let dropped = false;
  for (const tag of tags) {
    if (tag === null || tag === undefined) continue;
    if (isExhibitionTag(tag)) out.add(tag);
    else dropped = true;
  }
  if (dropped || out.size > MAX_REVALIDATE_TAGS) return [EXHIBITION_TAG];
  return [...out];
}
