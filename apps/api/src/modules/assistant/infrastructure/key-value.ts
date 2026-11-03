import { Redis } from 'ioredis';

/**
 * The small key-value store the assistant needs for rate limits, the daily token budget and the weather
 * cache: Redis in production (`REDIS_URL`), in memory for tests and a single local process.
 */
export interface KeyValueStore {
  /** Adds `by` to a counter, starting its expiry on first use; returns the new value. */
  increment(key: string, ttlSeconds: number, by?: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Seconds before `key` expires (0 if it does not exist). */
  ttl(key: string): Promise<number>;
}

export class InMemoryKeyValueStore implements KeyValueStore {
  private readonly data = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string) {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  async increment(key: string, ttlSeconds: number, by = 1): Promise<number> {
    const entry = this.live(key);
    const value = Number(entry?.value ?? 0) + by;
    this.data.set(key, {
      value: String(value),
      expiresAt: entry?.expiresAt ?? this.now() + ttlSeconds * 1000,
    });
    return value;
  }

  async get(key: string): Promise<string | null> {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async ttl(key: string): Promise<number> {
    const entry = this.live(key);
    return entry ? Math.ceil((entry.expiresAt - this.now()) / 1000) : 0;
  }
}

export class RedisKeyValueStore implements KeyValueStore {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  }

  async increment(key: string, ttlSeconds: number, by = 1): Promise<number> {
    const [[, value]] = (await this.redis
      .multi()
      .incrby(key, by)
      .expire(key, ttlSeconds, 'NX')
      .exec()) as [[unknown, number], [unknown, number]];
    return value;
  }

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    return Math.max(0, await this.redis.ttl(key));
  }

  async close(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}

/** DI token of the assistant's `KeyValueStore`. */
export const ASSISTANT_KV = Symbol('ASSISTANT_KV');
