/** Where a price hint came from: the household's own past offers, public listings, or both. */
export type PriceHintBasis = 'OWN' | 'CATALOG' | 'MIXED';

export interface PriceHint {
  minVnd: number;
  maxVnd: number;
  basis: PriceHintBasis;
  ownSamples: number;
  catalogSamples: number;
}

/** With this many past offers of its own, a household's hint ignores the catalogue. */
export const OWN_SAMPLES_ENOUGH = 3;
const ROUND_TO = 1_000;

function percentile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  const a = sorted[low] as number;
  const b = sorted[high] as number;
  return a + (b - a) * (position - low);
}

const valid = (prices: readonly number[]) =>
  prices.filter((price) => Number.isSafeInteger(price) && price > 0);

/**
 * A suggested unit price range for a bid (PLAN E9, FR-RFQ): the interquartile range (P25–P75) of the
 * household's own past unit prices and the prices of comparable public products, rounded to the
 * nearest 1,000 VND. Three or more own offers are enough on their own; with fewer, the catalogue fills
 * in. Other households' sealed offers are never an input. `null` when there is nothing to go on.
 */
export function suggestPriceRange(
  ownPastPrices: readonly number[],
  catalogPrices: readonly number[],
): PriceHint | null {
  const own = valid(ownPastPrices);
  const catalog = own.length >= OWN_SAMPLES_ENOUGH ? [] : valid(catalogPrices);
  const pool = [...own, ...catalog].sort((a, b) => a - b);
  if (pool.length === 0) return null;
  const round = (value: number) => Math.max(ROUND_TO, Math.round(value / ROUND_TO) * ROUND_TO);
  const basis: PriceHintBasis =
    catalog.length === 0 ? 'OWN' : own.length === 0 ? 'CATALOG' : 'MIXED';
  return {
    minVnd: round(percentile(pool, 0.25)),
    maxVnd: round(percentile(pool, 0.75)),
    basis,
    ownSamples: own.length,
    catalogSamples: catalog.length,
  };
}
