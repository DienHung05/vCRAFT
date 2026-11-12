import { villageToday } from '@vcraft/domain';
import { vi } from 'vitest';

/**
 * Pins `Date` (nothing else, so DB, HTTP and container timers keep running) to a fixed time of day on
 * the current village date and returns that date (YYYY-MM-DD). Outage tests need it: the banner only
 * shows cuts that have not ended yet (ADR-0023), and a cut can end at 23:59 at the latest, so a test
 * run in the last minutes of the village day, or across midnight, would otherwise see nothing or a
 * different date. Call it after the app and database are up and undo it with `releaseVillageClock`.
 */
export function pinVillageClock(timeOfDay = '10:00'): string {
  const date = villageToday();
  // Village time is UTC+7 all year (no daylight saving).
  vi.useFakeTimers({ now: new Date(`${date}T${timeOfDay}:00+07:00`), toFake: ['Date'] });
  return date;
}

export function releaseVillageClock(): void {
  vi.useRealTimers();
}
