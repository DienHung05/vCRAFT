import { describe, expect, it } from 'vitest';
import {
  isRatingEditable,
  RATING_EDIT_WINDOW_DAYS,
  ratingEditableUntil,
  summarizeRatings,
} from '../src';

describe('household rating rules', () => {
  const given = new Date('2026-11-01T00:00:00.000Z');

  it('stays editable for the whole window and closes right after it', () => {
    const until = ratingEditableUntil(given);
    expect(until.getTime() - given.getTime()).toBe(RATING_EDIT_WINDOW_DAYS * 86_400_000);
    expect(isRatingEditable(given, new Date(until.getTime()))).toBe(true);
    expect(isRatingEditable(given, new Date(until.getTime() + 1))).toBe(false);
  });

  it('averages to one decimal and has no average when empty', () => {
    expect(summarizeRatings([])).toEqual({ average: null, count: 0 });
    expect(summarizeRatings([5, 4, 4])).toEqual({ average: 4.3, count: 3 });
    expect(summarizeRatings([1, 2])).toEqual({ average: 1.5, count: 2 });
    expect(summarizeRatings([3])).toEqual({ average: 3, count: 1 });
  });
});
