import { createHash } from 'node:crypto';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppError } from '../errors/app-error';

const INCREMENT =
  "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n";

/** Shared limits in production. Redis failure closes the endpoint instead of disabling protection. */
@Injectable()
export class AuthRateLimit implements OnModuleDestroy {
  private readonly redis = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      })
    : null;
  private readonly local = new Map<string, { count: number; expires: number }>();
  private connecting: Promise<void> | undefined;

  async check(ip: string, operation: 'sign-in' | 'sign-up' | 'availability', identifier?: string) {
    const limit = operation === 'availability' ? 60 : operation === 'sign-up' ? 5 : 15;
    const ttl = operation === 'sign-up' ? 300 : 60;
    const subjects = [`ip:${ip}`];
    if (identifier) subjects.push(`account:${identifier.trim().toLowerCase()}`);
    for (const subject of subjects) {
      const hash = createHash('sha256').update(subject).digest('hex');
      const key = `auth:rate:${operation}:${hash}`;
      let count: number;
      try {
        if (this.redis) {
          if (this.redis.status === 'wait') this.connecting ??= this.redis.connect();
          await this.connecting;
          count = Number(await this.redis.eval(INCREMENT, 1, key, ttl));
        } else {
          if (process.env.NODE_ENV === 'production') throw new Error('Redis required');
          const now = Date.now();
          for (const [entryKey, entry] of this.local)
            if (entry.expires <= now) this.local.delete(entryKey);
          const entry = this.local.get(key) ?? { count: 0, expires: now + ttl * 1000 };
          count = ++entry.count;
          this.local.set(key, entry);
        }
      } catch {
        throw new AppError('SERVICE_UNAVAILABLE');
      }
      if (!Number.isFinite(count)) throw new AppError('SERVICE_UNAVAILABLE');
      if (count > limit) throw new AppError('RATE_LIMITED');
    }
  }

  onModuleDestroy() {
    this.redis?.disconnect();
  }
}
