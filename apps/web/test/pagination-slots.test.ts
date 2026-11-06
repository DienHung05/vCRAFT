import { describe, expect, it } from 'vitest';
import { paginationSlots } from '@/features/catalog/pagination-slots';

const S = 'gap-start';
const E = 'gap-end';

describe('paginationSlots (7 cells)', () => {
  it('has no cells without pages and one cell for a single page', () => {
    expect(paginationSlots(1, 0)).toEqual([]);
    expect(paginationSlots(1, 1)).toEqual([1]);
  });

  it('shows every page when there are 7 or fewer', () => {
    expect(paginationSlots(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(paginationSlots(1, 2)).toEqual([1, 2]);
  });

  it('11 pages: first, middle and last page', () => {
    expect(paginationSlots(1, 11)).toEqual([1, 2, 3, 4, 5, E, 11]);
    expect(paginationSlots(6, 11)).toEqual([1, S, 5, 6, 7, E, 11]);
    expect(paginationSlots(11, 11)).toEqual([1, S, 7, 8, 9, 10, 11]);
  });

  it('never uses a gap for a single page', () => {
    // Page 4 of 11 would leave only page 2 behind a start gap, so the edge block is used.
    expect(paginationSlots(4, 11)).toEqual([1, 2, 3, 4, 5, E, 11]);
    expect(paginationSlots(8, 11)).toEqual([1, S, 7, 8, 9, 10, 11]);
    expect(paginationSlots(5, 11)).toEqual([1, S, 4, 5, 6, E, 11]);
    expect(paginationSlots(7, 11)).toEqual([1, S, 6, 7, 8, E, 11]);
  });

  it('100 pages', () => {
    expect(paginationSlots(1, 100)).toEqual([1, 2, 3, 4, 5, E, 100]);
    expect(paginationSlots(50, 100)).toEqual([1, S, 49, 50, 51, E, 100]);
    expect(paginationSlots(100, 100)).toEqual([1, S, 96, 97, 98, 99, 100]);
  });

  it('keeps 7 cells for every current page of 8 to 30 pages and every gap hides 2+ pages', () => {
    for (let total = 8; total <= 30; total += 1) {
      for (let current = 1; current <= total; current += 1) {
        const slots = paginationSlots(current, total);
        expect(slots).toHaveLength(7);
        expect(slots).toContain(current);
        expect(slots[0]).toBe(1);
        expect(slots.at(-1)).toBe(total);
        slots.forEach((slot, index) => {
          if (typeof slot === 'number') return;
          const before = slots[index - 1] as number;
          const after = slots[index + 1] as number;
          expect(after - before - 1).toBeGreaterThanOrEqual(2);
        });
      }
    }
  });

  it('clamps an out-of-range current page', () => {
    expect(paginationSlots(99, 11)).toEqual(paginationSlots(11, 11));
    expect(paginationSlots(0, 11)).toEqual(paginationSlots(1, 11));
  });
});

describe('paginationSlots (5 cells, phones)', () => {
  it('shows every page when there are 5 or fewer', () => {
    expect(paginationSlots(2, 5, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('keeps 5 cells and the current page for any position', () => {
    expect(paginationSlots(1, 11, 5)).toEqual([1, 2, 3, E, 11]);
    expect(paginationSlots(6, 11, 5)).toEqual([1, S, 6, E, 11]);
    expect(paginationSlots(11, 11, 5)).toEqual([1, S, 9, 10, 11]);
    for (let total = 6; total <= 30; total += 1) {
      for (let current = 1; current <= total; current += 1) {
        const slots = paginationSlots(current, total, 5);
        expect(slots).toHaveLength(5);
        expect(slots).toContain(current);
        slots.forEach((slot, index) => {
          if (typeof slot === 'number') return;
          const gap = (slots[index + 1] as number) - (slots[index - 1] as number) - 1;
          expect(gap).toBeGreaterThanOrEqual(2);
        });
      }
    }
  });
});
