/** One cell of the page bar: a page number, or a gap that stands for the pages it hides. */
export type PaginationSlot = number | 'gap-start' | 'gap-end';

/**
 * Cells of the numbered page bar. With more pages than `slotCount` the bar always has exactly
 * `slotCount` cells, so it keeps one width while the reader pages through. The first and last page
 * always show, the current page keeps `siblings` neighbours on each side, and a gap is only used
 * when it hides at least two pages (a gap for a single page shows that page instead).
 *
 * `slotCount` is 7 (one sibling) by default and 5 (no siblings) for phones.
 */
export function paginationSlots(
  current: number,
  total: number,
  slotCount: 5 | 7 = 7,
): PaginationSlot[] {
  if (total < 1) return [];
  const page = Math.min(Math.max(Math.trunc(current) || 1, 1), total);
  if (total <= slotCount) return Array.from({ length: total }, (_, index) => index + 1);

  const siblings = (slotCount - 5) / 2;
  const edge = 2 * siblings + 3;
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => from + index);

  if (page <= siblings + 3) return [...range(1, edge), 'gap-end', total];
  if (page >= total - siblings - 2) return [1, 'gap-start', ...range(total - edge + 1, total)];
  return [1, 'gap-start', ...range(page - siblings, page + siblings), 'gap-end', total];
}
