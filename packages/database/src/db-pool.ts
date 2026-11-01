import type { MikroORM } from '@mikro-orm/core';

/** Subset of `process.env` read by the pool settings (see `.env.example`). */
type PoolEnv = Readonly<Record<string, string | undefined>>;

/**
 * Connection pool behaviour shared by the API, the worker and the CLIs.
 *
 * Supabase's Supavisor *session* pooler pins one server connection per client connection and caps the
 * number of clients at the project's `pool_size` (15 by default) per user and database. The API, the
 * worker, migrations, `pg_cron` and every developer machine draw from that one budget, so the defaults
 * here are deliberately small. Every wait is bounded, so a pool that cannot make progress turns into
 * fast 503s instead of requests that hang until the client gives up.
 */
export interface DbPoolSettings {
  /** Most connections this process opens (`DB_POOL_MAX`). */
  max: number;
  /** Connections kept open while idle (`DB_POOL_MIN`). */
  min: number;
  /** An idle connection is closed after this long (`DB_POOL_IDLE_TIMEOUT_MS`). */
  idleTimeoutMillis: number;
  /**
   * Longest a request waits to obtain a connection, counting both a free slot in this pool and the time to
   * open a new connection (`DB_POOL_ACQUIRE_TIMEOUT_MS`, PostgreSQL only; MySQL bounds only the connect).
   */
  acquireTimeoutMillis: number;
  /**
   * A statement still unanswered after this long is treated as hung: the connection is destroyed so the pool
   * replaces it (`DB_QUERY_TIMEOUT_MS`, PostgreSQL only, `0` disables).
   */
  queryTimeoutMillis: number;
}

export const DB_POOL_DEFAULTS: Readonly<DbPoolSettings> = {
  max: 5,
  min: 0,
  idleTimeoutMillis: 30_000,
  acquireTimeoutMillis: 5_000,
  queryTimeoutMillis: 20_000,
};

/** First TCP keepalive probe on an idle socket; keeps NAT/pooler mappings warm and surfaces dead peers. */
const KEEPALIVE_INITIAL_DELAY_MS = 10_000;

function readInt(env: PoolEnv, name: string, fallback: number, minimum: number): number {
  const raw = env[name]?.trim();
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name}="${raw}" is not valid; expected an integer >= ${minimum}`);
  }
  return value;
}

/** Reads the pool settings from the environment, falling back to {@link DB_POOL_DEFAULTS}. */
export function resolveDbPoolSettings(env: PoolEnv = process.env): DbPoolSettings {
  const max = readInt(env, 'DB_POOL_MAX', DB_POOL_DEFAULTS.max, 1);
  const min = readInt(env, 'DB_POOL_MIN', DB_POOL_DEFAULTS.min, 0);
  if (min > max) throw new Error(`DB_POOL_MIN (${min}) must not exceed DB_POOL_MAX (${max})`);
  return {
    max,
    min,
    idleTimeoutMillis: readInt(
      env,
      'DB_POOL_IDLE_TIMEOUT_MS',
      DB_POOL_DEFAULTS.idleTimeoutMillis,
      1,
    ),
    acquireTimeoutMillis: readInt(
      env,
      'DB_POOL_ACQUIRE_TIMEOUT_MS',
      DB_POOL_DEFAULTS.acquireTimeoutMillis,
      1,
    ),
    queryTimeoutMillis: readInt(env, 'DB_QUERY_TIMEOUT_MS', DB_POOL_DEFAULTS.queryTimeoutMillis, 0),
  };
}

/** The slice of a `pg` client that {@link guardPgPool} relies on. */
interface GuardedPgClient {
  query: (...args: unknown[]) => unknown;
  connection?: { stream?: { destroy: (error?: Error) => unknown } };
}
interface GuardedPgPool {
  on: (event: 'connect', listener: (client: GuardedPgClient) => void) => unknown;
}

const isThenable = (value: unknown): value is PromiseLike<unknown> & { finally: () => unknown } =>
  typeof (value as { then?: unknown } | null)?.then === 'function';

/**
 * A `pg` client whose server (or the network path to it) goes silent keeps waiting for the answer forever:
 * neither `pg` nor the kernel give up for many minutes, and the client stays checked out of the pool. After
 * `max` such queries every request waits for a connection that never frees. This destroys the connection of any
 * statement that is still unanswered after `queryTimeoutMillis`; the caller's query rejects with
 * "Connection terminated unexpectedly" and the pool opens a fresh client next time.
 *
 * `pg`'s own `query_timeout` is not enough: it rejects the caller but hands the dead socket back to the pool.
 */
export function guardPgPool(pool: GuardedPgPool, queryTimeoutMillis: number): void {
  if (queryTimeoutMillis <= 0) return;
  pool.on('connect', (client) => {
    const query = client.query.bind(client);
    client.query = (...args: unknown[]) => {
      const result = query(...args);
      // Only the promise form (what Kysely/MikroORM use) is timed; callback and cursor forms pass through.
      if (!isThenable(result)) return result;
      const timer = setTimeout(() => {
        client.connection?.stream?.destroy(
          new Error(
            `No response from the database for ${queryTimeoutMillis} ms; connection dropped`,
          ),
        );
      }, queryTimeoutMillis);
      return (result as Promise<unknown>).finally(() => clearTimeout(timer));
    };
  });
}

/** Driver-specific pool options (merged by MikroORM into the `pg`/`mysql2` pool constructor options). */
export function buildPoolDriverOptions(
  driver: 'postgresql' | 'mysql',
  settings: DbPoolSettings,
): Record<string, unknown> {
  if (driver === 'mysql') {
    return {
      connectTimeout: settings.acquireTimeoutMillis,
      enableKeepAlive: true,
      keepAliveInitialDelay: KEEPALIVE_INITIAL_DELAY_MS,
    };
  }
  return {
    // pg-pool applies this to waiting for a free client as well as to opening a new connection.
    connectionTimeoutMillis: settings.acquireTimeoutMillis,
    keepAlive: true,
    keepAliveInitialDelayMillis: KEEPALIVE_INITIAL_DELAY_MS,
    onPoolCreated: (pool: GuardedPgPool) => guardPgPool(pool, settings.queryTimeoutMillis),
  };
}

export interface DbPoolStats {
  /** Connections currently open (busy + idle). */
  total: number;
  idle: number;
  /** Callers queued for a connection. */
  waiting: number;
  max: number;
}

interface PgPoolLike {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  options: { max?: number };
}

/** Live pool counters; `undefined` for drivers whose pool does not expose them (MySQL). */
export async function getDbPoolStats(orm: MikroORM): Promise<DbPoolStats | undefined> {
  const connection = orm.em.getConnection() as unknown as {
    getNativeClient?: () => Promise<unknown>;
  };
  const pool = (await connection.getNativeClient?.()) as Partial<PgPoolLike> | undefined;
  if (typeof pool?.totalCount !== 'number') return undefined;
  return {
    total: pool.totalCount,
    idle: pool.idleCount ?? 0,
    waiting: pool.waitingCount ?? 0,
    max: pool.options?.max ?? DB_POOL_DEFAULTS.max,
  };
}

const UNAVAILABLE_CODES = new Set([
  // Node socket errors
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  // PostgreSQL: admin shutdown, crash shutdown, cannot connect now, too many connections
  '57P01',
  '57P02',
  '57P03',
  '53300',
  // mysql2
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
  'ER_SERVER_SHUTDOWN',
]);

const UNAVAILABLE_MESSAGES = [
  // pg-pool: no connection became available within `connectionTimeoutMillis`
  'timeout exceeded when trying to connect',
  // pg: socket closed under a query / during connect
  'connection terminated',
  'connection timeout',
  'no response from the database',
  // Supavisor: session-mode client limit
  'max clients reached',
  'max client connections reached',
  'emaxconnsession',
  // pg-pool after `end()`, mysql2
  'cannot use a pool after calling end',
  'connection lost',
];

/**
 * True when `error` means the database could not be reached or answered in time (pool wait timed out, link
 * dropped, pooler full), as opposed to a query that was wrong. The API answers these with 503.
 */
export function isDbUnavailableError(error: unknown, depth = 0): boolean {
  if (typeof error !== 'object' || error === null || depth > 3) return false;
  const { code, message, cause } = error as { code?: unknown; message?: unknown; cause?: unknown };
  if (typeof code === 'string' && (UNAVAILABLE_CODES.has(code) || code.startsWith('08'))) {
    return true;
  }
  if (typeof message === 'string') {
    const lower = message.toLowerCase();
    if (UNAVAILABLE_MESSAGES.some((needle) => lower.includes(needle))) return true;
  }
  return isDbUnavailableError(cause, depth + 1);
}
