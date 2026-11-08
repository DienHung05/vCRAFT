import { normalizeSearchText } from '@vcraft/utils';

const TRACKING = /^(utm_|fbclid|gclid|mc_|ref$|ref_)/i;

/** The link without tracking parameters, fragment, `www.` and trailing slash, so one story has one key. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()])
      if (TRACKING.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const query = url.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** Lowercase, without accents or punctuation. */
export const normalizeTitle = (title: string): string => normalizeSearchText(title, 400);

const tokens = (title: string) =>
  new Set(
    normalizeTitle(title)
      .split(' ')
      .filter((word) => word.length > 1),
  );

/** Same story under a slightly different headline: equal after normalising, or at least 80% of words shared. */
export function nearIdenticalTitles(a: string, b: string): boolean {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return false;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared++;
  return shared / (left.size + right.size - shared) >= 0.8;
}

export type DuplicateReason = 'same-url' | 'similar-title';

/** What a candidate collides with among the stories already stored (or accepted earlier in the same run). */
export function duplicateOf(
  candidate: { link: string; title: string },
  known: ReadonlyArray<{ url: string | null; title: string }>,
): DuplicateReason | null {
  const url = canonicalUrl(candidate.link);
  for (const entry of known) if (entry.url && canonicalUrl(entry.url) === url) return 'same-url';
  for (const entry of known)
    if (nearIdenticalTitles(candidate.title, entry.title)) return 'similar-title';
  return null;
}
