import type { Logger } from '@nestjs/common';

/** The part of a BullMQ `Worker` or `Queue` that emits connection errors. */
export interface ErrorSource {
  name: string;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

/** Least time between two log lines for one source; errors in between are counted, not logged. */
export const ERROR_LOG_INTERVAL_MS = 30_000;

/**
 * Logs the `error` events of BullMQ workers and queues (GH#429). BullMQ re-emits ioredis errors
 * (ECONNRESET, a Redis restart, OOM) as `error`; with no listener Node treats them as uncaught
 * exceptions and the process crash-loops. Redis can fail dozens of times a second while it is down, so
 * each source logs at most once per interval, with the number of errors it swallowed meanwhile.
 */
export function logConnectionErrors(
  sources: ErrorSource[],
  logger: Pick<Logger, 'error'>,
  now: () => number = Date.now,
  intervalMs: number = ERROR_LOG_INTERVAL_MS,
): void {
  for (const source of sources) {
    let lastLoggedAt = Number.NEGATIVE_INFINITY;
    let suppressed = 0;
    source.on('error', (error) => {
      const at = now();
      if (at - lastLoggedAt < intervalMs) {
        suppressed += 1;
        return;
      }
      const extra = suppressed > 0 ? ` (+${suppressed} similar since the last log)` : '';
      suppressed = 0;
      lastLoggedAt = at;
      logger.error(`${source.name} connection error: ${error.message}${extra}`);
    });
  }
}
