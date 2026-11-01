import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPoolDriverOptions,
  DB_POOL_DEFAULTS,
  guardPgPool,
  isDbUnavailableError,
  resolveDbPoolSettings,
} from '../src/db-pool.js';
import { createMikroOrmOptions } from '../src/mikro-orm.config.js';

describe('resolveDbPoolSettings', () => {
  it('uses small, bounded defaults sized for the Supavisor session pooler', () => {
    expect(resolveDbPoolSettings({})).toEqual(DB_POOL_DEFAULTS);
    expect(DB_POOL_DEFAULTS.max).toBeLessThanOrEqual(5);
    expect(DB_POOL_DEFAULTS.acquireTimeoutMillis).toBeGreaterThan(0);
    expect(DB_POOL_DEFAULTS.queryTimeoutMillis).toBeGreaterThan(0);
  });

  it('reads every setting from the environment', () => {
    expect(
      resolveDbPoolSettings({
        DB_POOL_MAX: '8',
        DB_POOL_MIN: '1',
        DB_POOL_IDLE_TIMEOUT_MS: '12000',
        DB_POOL_ACQUIRE_TIMEOUT_MS: '2500',
        DB_QUERY_TIMEOUT_MS: '0',
      }),
    ).toEqual({
      max: 8,
      min: 1,
      idleTimeoutMillis: 12_000,
      acquireTimeoutMillis: 2_500,
      queryTimeoutMillis: 0,
    });
  });

  it('treats blank values as unset', () => {
    expect(resolveDbPoolSettings({ DB_POOL_MAX: '  ' })).toEqual(DB_POOL_DEFAULTS);
  });

  it.each([
    [{ DB_POOL_MAX: '0' }, /DB_POOL_MAX/],
    [{ DB_POOL_MAX: 'many' }, /DB_POOL_MAX/],
    [{ DB_POOL_MIN: '-1' }, /DB_POOL_MIN/],
    [{ DB_POOL_IDLE_TIMEOUT_MS: '0' }, /DB_POOL_IDLE_TIMEOUT_MS/],
    [{ DB_POOL_ACQUIRE_TIMEOUT_MS: '0' }, /DB_POOL_ACQUIRE_TIMEOUT_MS/],
    [{ DB_QUERY_TIMEOUT_MS: '1.5' }, /DB_QUERY_TIMEOUT_MS/],
    [{ DB_POOL_MIN: '6', DB_POOL_MAX: '5' }, /must not exceed/],
  ])('rejects %j', (env, message) => {
    expect(() => resolveDbPoolSettings(env)).toThrow(message);
  });
});

describe('pool options in the MikroORM config', () => {
  it('applies the pool size, idle timeout and bounded waits for PostgreSQL', () => {
    const options = createMikroOrmOptions({
      DB_DRIVER: 'postgresql',
      DB_POOL_MAX: '4',
      DB_POOL_ACQUIRE_TIMEOUT_MS: '3000',
    });
    expect(options.pool).toEqual({
      min: 0,
      max: 4,
      idleTimeoutMillis: DB_POOL_DEFAULTS.idleTimeoutMillis,
    });
    expect(options.driverOptions).toMatchObject({
      connectionTimeoutMillis: 3000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
    });
    expect(typeof options.driverOptions?.onPoolCreated).toBe('function');
  });

  it('bounds the connect and enables keepalive for MySQL', () => {
    const options = createMikroOrmOptions({
      DB_DRIVER: 'mysql',
      DB_POOL_ACQUIRE_TIMEOUT_MS: '3000',
    });
    expect(options.pool?.max).toBe(DB_POOL_DEFAULTS.max);
    expect(options.driverOptions).toMatchObject({
      connectTimeout: 3000,
      enableKeepAlive: true,
    });
  });

  it('keeps TLS options next to the pool options', () => {
    const options = createMikroOrmOptions({ DB_SSL: 'true' });
    expect(options.driverOptions).toMatchObject({
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: DB_POOL_DEFAULTS.acquireTimeoutMillis,
    });
  });

  it('rejects an invalid pool setting when the config is built', () => {
    expect(() => createMikroOrmOptions({ DB_POOL_MAX: 'x' })).toThrow(/DB_POOL_MAX/);
  });
});

describe('guardPgPool', () => {
  class FakePool extends EventEmitter {}

  /** A `pg` client whose `query` returns whatever the test chooses and records `stream.destroy`. */
  function connectClient(
    pool: FakePool,
    answer: () => unknown,
  ): { query: (...args: unknown[]) => unknown; destroyed: Error[] } {
    const destroyed: Error[] = [];
    const client = {
      query: (..._args: unknown[]) => answer(),
      connection: { stream: { destroy: (error?: Error) => void destroyed.push(error as Error) } },
    };
    pool.emit('connect', client);
    return { query: client.query, destroyed };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('destroys the connection of a query that is still unanswered after the timeout', async () => {
    const pool = new FakePool();
    guardPgPool(pool, 1_000);
    const hung = new Promise(() => undefined);
    const client = connectClient(pool, () => hung);

    void client.query('select 1');
    await vi.advanceTimersByTimeAsync(999);
    expect(client.destroyed).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2);
    expect(client.destroyed).toHaveLength(1);
    expect(client.destroyed[0]?.message).toMatch(/No response from the database/);
  });

  it('leaves a query that answers in time alone, and clears its timer', async () => {
    const pool = new FakePool();
    guardPgPool(pool, 1_000);
    const client = connectClient(pool, () => Promise.resolve({ rows: [] }));

    await expect(client.query('select 1')).resolves.toEqual({ rows: [] });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(client.destroyed).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('passes a failing query through unchanged and clears its timer', async () => {
    const pool = new FakePool();
    guardPgPool(pool, 1_000);
    const client = connectClient(pool, () => Promise.reject(new Error('syntax error')));

    await expect(client.query('selec')).rejects.toThrow('syntax error');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not touch non-promise (callback or cursor) queries', async () => {
    const pool = new FakePool();
    guardPgPool(pool, 1_000);
    const cursor = { read: () => undefined };
    const client = connectClient(pool, () => cursor);

    expect(client.query('select 1')).toBe(cursor);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(client.destroyed).toHaveLength(0);
  });

  it('does nothing when the timeout is 0', () => {
    const pool = new FakePool();
    guardPgPool(pool, 0);
    expect(pool.listenerCount('connect')).toBe(0);
  });

  it('is installed on the pool through the driver options', () => {
    const pool = new FakePool();
    const options = buildPoolDriverOptions('postgresql', {
      ...DB_POOL_DEFAULTS,
      queryTimeoutMillis: 500,
    });
    (options.onPoolCreated as (pool: FakePool) => void)(pool);
    expect(pool.listenerCount('connect')).toBe(1);
  });
});

describe('isDbUnavailableError', () => {
  it.each([
    ['pg-pool acquire timeout', new Error('timeout exceeded when trying to connect')],
    ['pg connect timeout', new Error('Connection terminated due to connection timeout')],
    ['pg dropped socket', new Error('Connection terminated unexpectedly')],
    [
      'hung query guard',
      new Error('No response from the database for 20000 ms; connection dropped'),
    ],
    ['Supavisor session limit', new Error('(EMAXCONNSESSION) max clients reached in session mode')],
    ['socket reset', Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })],
    [
      'postgres shutting down',
      Object.assign(new Error('terminating connection'), { code: '57P01' }),
    ],
    ['postgres connection exception class', Object.assign(new Error('x'), { code: '08006' })],
    ['mysql2 lost connection', Object.assign(new Error('x'), { code: 'PROTOCOL_CONNECTION_LOST' })],
    [
      'wrapped cause',
      new Error('query failed', { cause: new Error('Connection terminated unexpectedly') }),
    ],
  ])('recognises %s', (_name, error) => {
    expect(isDbUnavailableError(error)).toBe(true);
  });

  it.each([
    [
      'syntax error',
      Object.assign(new Error('syntax error at or near "selec"'), { code: '42601' }),
    ],
    ['unique violation', Object.assign(new Error('duplicate key'), { code: '23505' })],
    ['plain error', new Error('boom')],
    ['non-error', 'Connection terminated'],
    ['null', null],
  ])('does not treat %s as the database being unavailable', (_name, error) => {
    expect(isDbUnavailableError(error)).toBe(false);
  });
});
