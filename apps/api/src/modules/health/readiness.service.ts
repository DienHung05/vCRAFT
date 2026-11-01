import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { type DbPoolStats, getDbPoolStats } from '@vcraft/database';

/** Longest `GET /health/ready` waits for the database before reporting it down (`HEALTH_READY_TIMEOUT_MS`). */
const DEFAULT_TIMEOUT_MS = 2_000;

export interface ReadinessReport {
  ready: boolean;
  /** Why the database check failed; absent when ready. */
  reason?: string;
  /** Milliseconds the `select 1` round trip took (or how long we waited before giving up). */
  databaseMs: number;
  pool?: DbPoolStats;
}

function readTimeout(): number {
  const parsed = Number(process.env.HEALTH_READY_TIMEOUT_MS);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

/**
 * Dependency check behind `GET /api/v1/health/ready`. Unlike the liveness probe it takes a connection from the
 * same pool the requests use, so a wedged pool, an unreachable database or an exhausted pooler shows up here
 * while `/health` keeps answering 200.
 */
@Injectable()
export class ReadinessService {
  constructor(private readonly orm: MikroORM) {}

  async check(timeoutMs = readTimeout()): Promise<ReadinessReport> {
    const started = performance.now();
    let reason: string | undefined;
    let timer: NodeJS.Timeout | undefined;
    try {
      const ping = this.orm.em.getConnection().execute('select 1');
      // The pool bounds the ping too; the timeout only keeps the probe fast, and a late result must not go unhandled.
      ping.catch(() => undefined);
      await Promise.race([
        ping,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`no answer within ${timeoutMs} ms`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timer);
    }
    const databaseMs = Math.round(performance.now() - started);
    const pool = await getDbPoolStats(this.orm).catch(() => undefined);
    return {
      ready: reason === undefined,
      ...(reason !== undefined && { reason }),
      databaseMs,
      ...(pool && { pool }),
    };
  }
}
