/** FR-PRD-07: no suggestion is shown below this many comparable published products. */
export const MIN_PRICE_SUGGESTION_SAMPLES = 3;

export interface PriceSuggestion {
  /** Median unit price (VND) of the comparable products, rounded to a whole dong. */
  readonly medianVnd: number;
  /** How many products the median is based on. */
  readonly count: number;
}

/**
 * Median of the listed prices (VND) of comparable published products. Unlisted prices (`0`, "contact
 * for a quote") are ignored; returns `null` when fewer than `MIN_PRICE_SUGGESTION_SAMPLES` remain.
 */
export function suggestProductPrice(prices: readonly number[]): PriceSuggestion | null {
  const sorted = prices.filter((price) => price > 0).sort((a, b) => a - b);
  if (sorted.length < MIN_PRICE_SUGGESTION_SAMPLES) return null;
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1] as number;
  const high = sorted[middle] as number;
  const medianVnd = sorted.length % 2 === 1 ? high : Math.round((low + high) / 2);
  return { medianVnd, count: sorted.length };
}
