import { normalizeSearchText } from '../slug';

/** One province-level unit and the names of its wards/communes (post-2025: 34 provinces, no districts). */
export type AdministrativeUnit = readonly [
  code: number,
  province: string,
  wards: readonly string[],
];

/**
 * Completions for the part of an address after its last comma: `"12 Giang Cao, bat tr"` suggests
 * `"12 Giang Cao, Xã Bát Tràng, Thành phố Hà Nội"`. Matching ignores diacritics and case, and every typed
 * word must start a word of the ward or the province name. The text before the comma is kept as typed,
 * so the result works as `<datalist>` options for the same input. Fewer than two letters suggest nothing.
 */
export function suggestAddresses(
  value: string,
  units: readonly AdministrativeUnit[],
  limit = 8,
): string[] {
  const cut = value.lastIndexOf(',');
  const head = cut >= 0 ? value.slice(0, cut + 1).trimEnd() : '';
  const terms = normalizeSearchText(cut >= 0 ? value.slice(cut + 1) : value, 120)
    .split(' ')
    .filter(Boolean);
  if (terms.join('').length < 2) return [];

  const prefix = head ? `${head} ` : '';
  const matches: string[] = [];
  for (const [, province, wards] of units) {
    const provinceWords = normalizeSearchText(province).split(' ');
    for (const ward of wards) {
      const words = [...normalizeSearchText(ward).split(' '), ...provinceWords];
      if (terms.every((term) => words.some((word) => word.startsWith(term)))) {
        matches.push(`${prefix}${ward}, ${province}`);
        if (matches.length >= limit) return matches;
      }
    }
  }
  return matches;
}
