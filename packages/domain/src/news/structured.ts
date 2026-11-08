import { type OutageAreaCode, VILLAGE_WIDE, type VillageAreaCode } from '../village/areas';

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

/** One planned cut: one local day (YYYY-MM-DD) between two HH:MM times, `from` before `to`. */
export interface Outage {
  date: string;
  from: string;
  to: string;
  /** Human description of the affected streets; never used to decide who is warned. */
  area: string;
  /** Who is warned (ADR-0023). Absent on legacy notices, which count as `VILLAGE_WIDE`. */
  areaCode?: OutageAreaCode;
}

/** `POWER_SCHEDULE` news: planned cuts. */
export interface PowerScheduleData {
  outages: ReadonlyArray<Outage>;
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

/** Time of day (HH:MM) in the village's time zone. */
export function villageTimeOfDay(now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/** The audience of a cut: its area code, or the whole village for a legacy cut without one (ADR-0023). */
export const outageAudience = (outage: Pick<Outage, 'areaCode'>): OutageAreaCode =>
  outage.areaCode ?? VILLAGE_WIDE;

/**
 * Whether a household is warned about a cut (ADR-0023): the cut is village-wide, or one of the household's
 * workshops is in its area. A household without any workshop area gets every cut (warn too much rather than miss one).
 */
export function outageReachesHousehold(
  outage: Pick<Outage, 'areaCode'>,
  workshopAreas: readonly (VillageAreaCode | null | undefined)[],
): boolean {
  const audience = outageAudience(outage);
  if (audience === VILLAGE_WIDE) return true;
  const known = workshopAreas.filter((area): area is VillageAreaCode => !!area);
  return known.length === 0 || known.includes(audience);
}

/**
 * The cuts to show at `now` (ADR-0023): those of the village date, from 00:00 until the end time (not
 * included), earliest first. Cuts stay within one date, so none carries over midnight. `workshopAreas` is the
 * household's, or `null` for an administrator, who sees every cut.
 */
export function activeOutages(
  schedules: readonly PowerScheduleData[],
  now: Date,
  workshopAreas: readonly (VillageAreaCode | null | undefined)[] | null,
): Outage[] {
  const time = villageTimeOfDay(now);
  return outagesOn(schedules, villageToday(now)).filter(
    (outage) =>
      time < outage.to && (workshopAreas === null || outageReachesHousehold(outage, workshopAreas)),
  );
}
