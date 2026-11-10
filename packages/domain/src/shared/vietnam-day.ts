/** A calendar day in Vietnam (UTC+7, no daylight saving) ends at 23:59:59 local time. */
const END_OF_DAY_SUFFIX = 'T23:59:59.000+07:00';

/**
 * The instant a Vietnam calendar date (`YYYY-MM-DD`) ends: 23:59:59 at +07:00, i.e. 16:59:59 UTC.
 * A date-only deadline or promised date means "by the end of that day", never its first hour.
 */
export function endOfVietnamDay(date: string): Date {
  return new Date(`${date}${END_OF_DAY_SUFFIX}`);
}
