import { createFormatter } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { formatDeclaredDate } from '@/lib/declared-date';

/**
 * Cases for GH#476, run once per process time zone by `declared-date.<zone>.test.ts` (each sets
 * `process.env.TZ` first). A date-only declared date must read as the same calendar day with no time,
 * whatever the machine's zone.
 */
export function declaredDateCases(zone: string, offsetMinutes: number) {
  describe(`formatDeclaredDate in ${zone} (GH#476)`, () => {
    it('runs in the expected time zone', () => {
      expect(process.env.TZ).toBe(zone);
      expect(new Date(2026, 5, 9, 12).getTimezoneOffset()).toBe(offsetMinutes);
    });

    const cases = [
      { locale: 'vi', long: '9 tháng 6, 2026', june: '09/06/2026', dec: '31/12/2026' },
      { locale: 'en', long: 'June 9, 2026', june: '06/09/2026', dec: '12/31/2026' },
    ] as const;

    for (const { locale, long, june, dec } of cases) {
      // The site formats in Viet Nam time; a date-only value must not depend on that either.
      const format = createFormatter({ locale, formats, timeZone: 'Asia/Ho_Chi_Minh' });

      it(`prints a date-only value as that calendar day with the year and no time (${locale})`, () => {
        expect(formatDeclaredDate(format, '2026-06-09')).toBe(long);
        expect(formatDeclaredDate(format, '2026-06-09')).not.toMatch(/\d:\d/);
        expect(formatDeclaredDate(format, '2026-06-09', 'short')).toBe(june);
      });

      it(`does not move the day at the edges of a year (${locale})`, () => {
        expect(formatDeclaredDate(format, '2026-01-01', 'short')).toBe('01/01/2026');
        expect(formatDeclaredDate(format, '2026-12-31', 'short')).toBe(dec);
      });
    }

    it('keeps the time of a value that really has one', () => {
      const format = createFormatter({ locale: 'vi', formats, timeZone: 'Asia/Ho_Chi_Minh' });
      const text = formatDeclaredDate(format, '2026-06-09T02:30:00.000Z');
      expect(text).toContain('9 tháng 6, 2026');
      expect(text).toContain('09:30');
    });
  });
}
