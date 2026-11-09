/**
 * Day helpers for the admin dashboard QR-scan trend (FR-ADM-06, vCRAFT-8my.4).
 *
 * The window is the last 30 Vietnam calendar dates (UTC+7, no daylight saving) including today, so the
 * buckets match the QR-scan figures the rest of the dashboard already reports in Vietnam time. Only
 * persisted `trace_scan` rows are counted and empty dates are zero-filled — history is never invented.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Vietnam has no daylight saving: always UTC+7. */
export const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** The 30 Vietnam calendar dates (`YYYY-MM-DD`) ending today, oldest first. */
export function last30VietnamDates(now = new Date()): string[] {
  const today = new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
  const todayUtcMs = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 30 }, (_, i) =>
    new Date(todayUtcMs - (29 - i) * DAY_MS).toISOString().slice(0, 10),
  );
}

/** The UTC instant of midnight (Vietnam time) of one `YYYY-MM-DD` Vietnam calendar date. */
export function vietnamDayStartUtc(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00+07:00`));
}

/** One aggregated per-day count as it comes back from the bounded GROUP BY query. */
export interface ScanDayRow {
  day: string;
  count: number;
}

/**
 * Zero-fills the aggregated per-day counts over the window's dates: each date without scans counts 0.
 * Days outside the window (the query must not return any) are ignored.
 */
export function zeroFilledTrend(
  dates: readonly string[],
  days: readonly ScanDayRow[],
): { date: string; count: number }[] {
  const counts = new Map(days.map((row) => [row.day, row.count]));
  return dates.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}
