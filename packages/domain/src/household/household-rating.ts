/**
 * Buyer ratings of households after delivery (FR-ORD-11, BR-05, GH#248 s5-11): 1 to 5 stars and an optional
 * comment, one rating per (request, household), editable by the buyer for a limited time.
 */
export const RATING_MIN_STARS = 1;
export const RATING_MAX_STARS = 5;
export const RATING_COMMENT_MAX = 1000;
/** How long after it was first given the buyer may still change a rating. */
export const RATING_EDIT_WINDOW_DAYS = 30;

const DAY_MS = 86_400_000;

/** The instant after which a rating given at `createdAt` can no longer be changed. */
export function ratingEditableUntil(createdAt: Date): Date {
  return new Date(createdAt.getTime() + RATING_EDIT_WINDOW_DAYS * DAY_MS);
}

/** Whether the buyer may still change a rating that was first given at `createdAt`. */
export function isRatingEditable(createdAt: Date, now: Date): boolean {
  return now.getTime() <= ratingEditableUntil(createdAt).getTime();
}

export interface RatingSummary {
  /** Mean of the stars with one decimal, or null when nobody has rated yet. */
  average: number | null;
  count: number;
}

/** Mean rating rounded to one decimal; an empty list has no average. */
export function summarizeRatings(stars: readonly number[]): RatingSummary {
  if (stars.length === 0) return { average: null, count: 0 };
  const sum = stars.reduce((total, value) => total + value, 0);
  return { average: Math.round((sum / stars.length) * 10) / 10, count: stars.length };
}
