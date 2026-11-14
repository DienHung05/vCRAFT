import type { LogContext, Logger, LoggerOptions } from '@mikro-orm/core';
import { Logger as NestLogger } from '@nestjs/common';

/** Queries at least this slow are logged (`SLOW_QUERY_MS`, GH#537). */
export const SLOW_QUERY_DEFAULT_MS = 200;

export const slowQueryThresholdMs = (
  env: Readonly<Record<string, string | undefined>> = process.env,
) => {
  const value = Number(env.SLOW_QUERY_MS);
  return Number.isFinite(value) && value > 0 ? value : SLOW_QUERY_DEFAULT_MS;
};

const MAX_SQL_CHARS = 600;

/**
 * Keeps the shape of a statement and drops the data: with query logging on, MikroORM may hand over SQL
 * with the parameters already inlined, and those can be personal data.
 */
export const redactSql = (sql: string): string =>
  sql
    .replace(/'(?:[^'\\]|\\.|'')*'/g, '?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SQL_CHARS);

/**
 * MikroORM logger for the `slow-query` channel only: one warning with the redacted SQL and the duration.
 * Everything else (`DB_DEBUG` output) keeps going through the default logger.
 */
export class SlowQueryLogger implements Logger {
  constructor(private readonly write: (message: string) => void) {}

  logQuery(context: LogContext): void {
    this.write(`${context.took ?? '?'}ms ${redactSql(context.query ?? '')}`);
  }

  log(): void {}
  error(): void {}
  warn(): void {}
  setDebugMode(): void {}
  isEnabled(): boolean {
    return true;
  }
}

/** MikroORM options that turn slow-query logging on for the API. */
export function slowQueryOptions(env: Readonly<Record<string, string | undefined>> = process.env) {
  const log = new NestLogger('SlowQuery');
  return {
    slowQueryThreshold: slowQueryThresholdMs(env),
    slowQueryLoggerFactory: (_options: LoggerOptions) =>
      new SlowQueryLogger((message) => log.warn(message)),
  };
}
