/**
 * Structured content of two news categories (PLAN E11, FR-NEWS): material prices, charted on the news page,
 * and power outage schedules, shown as a banner in Studio on the affected day.
 */

/** The materials whose prices the village board publishes. */
export const MATERIALS = ['CLAY', 'GLAZE', 'GAS'] as const;
export type Material = (typeof MATERIALS)[number];

/** `MATERIAL_PRICES` news: prices in force from `effectiveOn` (YYYY-MM-DD). */
export interface MaterialPriceData {
  effectiveOn: string;
  prices: ReadonlyArray<{ material: Material; unit: string; priceVnd: number }>;
}

/** `POWER_SCHEDULE` news: planned cuts, each on one local day (YYYY-MM-DD) between two HH:MM times. */
export interface PowerScheduleData {
  outages: ReadonlyArray<{ date: string; from: string; to: string; area: string }>;
}

export interface PricePoint {
  /** YYYY-MM */
  month: string;
  priceVnd: number;
}

export interface MaterialSeries {
  material: Material;
  unit: string;
  points: PricePoint[];
}

/** YYYY-MM of `date` shifted by `delta` months. */
function monthOf(date: string, delta = 0): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/**
 * One series per material over the last `months` calendar months ending with `today`'s month: each month
 * shows the price in force at its end (the latest `effectiveOn` on or before it), so a month without a new
 * notice carries the previous price. Months before the first known price are left out.
 */
export function materialPriceSeries(
  notices: readonly MaterialPriceData[],
  today: string,
  months = 6,
): MaterialSeries[] {
  const sorted = [...notices].sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn));
  const window = Array.from({ length: months }, (_, i) => monthOf(today, i - months + 1));
  return MATERIALS.flatMap((material) => {
    let unit = '';
    const points: PricePoint[] = [];
    for (const month of window) {
      let price: number | undefined;
      for (const notice of sorted) {
        if (monthOf(notice.effectiveOn) > month) break;
        const entry = notice.prices.find((p) => p.material === material);
        if (entry) {
          price = entry.priceVnd;
          unit = entry.unit;
        }
      }
      if (price !== undefined) points.push({ month, priceVnd: price });
    }
    return points.length > 0 ? [{ material, unit, points }] : [];
  });
}

/** The outages planned on `date` (YYYY-MM-DD, village local time), earliest first. */
export function outagesOn(
  schedules: readonly PowerScheduleData[],
  date: string,
): PowerScheduleData['outages'][number][] {
  return schedules
    .flatMap((schedule) => schedule.outages)
    .filter((outage) => outage.date === date)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** Today's date (YYYY-MM-DD) in the village's time zone. */
export function villageToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}
