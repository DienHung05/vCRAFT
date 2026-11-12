import type { createFormatter } from 'next-intl';

type Formatter = ReturnType<typeof createFormatter>;

/** A journal entry's `declaredDate` as the API sends it: a calendar day with no time ("2026-06-09"). */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a journal milestone's declared date (GH#476). A date-only value is a calendar day, not an
 * instant: it is read as that day in UTC and printed in UTC, so no time zone can move the day or invent
 * an hour (`new Date("2026-06-09")` is midnight UTC, which is 07:00 in Viet Nam). A value that really
 * carries a time keeps it, shown in the site's time zone.
 *
 * - `long`: day, month name and year ("9 tháng 6, 2026"); a timestamp adds the hour and minute.
 * - `short`: numeric day, month and year ("09/06/2026"), for the journey summary.
 */
export function formatDeclaredDate(
  format: Formatter,
  at: string,
  style: 'long' | 'short' = 'long',
): string {
  if (DATE_ONLY.test(at)) {
    return format.dateTime(new Date(`${at}T00:00:00Z`), style, { timeZone: 'UTC' });
  }
  return format.dateTime(new Date(at), style === 'long' ? 'longStamp' : 'short');
}
