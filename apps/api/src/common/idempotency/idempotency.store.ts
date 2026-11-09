import { MikroORM, UniqueConstraintViolationException } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { IDEMPOTENCY_KEY_TTL_MS, IdempotencyKey } from '@vcraft/database';

/** Who sent which key to which route: the unique scope of a key. */
export interface IdempotencyScope {
  actorId: string;
  /** `POST /api/v1/rfqs/<id>/submit`: method plus path, no query string. */
  route: string;
  key: string;
}

export interface StoredIdempotency {
  id: string;
  requestHash: string;
  /** `null` while the first request with this key is still running. */
  responseStatus: number | null;
  responseBody: unknown;
  createdAt: Date;
}

export type ClaimResult =
  | { claimed: true; id: string }
  | { claimed: false; existing: StoredIdempotency };

/** Persistence of `idempotency_keys`; the interceptor owns the rules, this only reads and writes rows. */
@Injectable()
export class IdempotencyStore {
  constructor(private readonly orm: MikroORM) {}

  /**
   * Claims the key by inserting its row before the handler runs. The unique (actor, route, key) index
   * makes this atomic: of two concurrent requests, exactly one claims and the other gets the row back.
   * Rows older than the 24 h TTL are dropped first, so an expired key can be used again.
   */
  async claim(scope: IdempotencyScope, requestHash: string, now: Date): Promise<ClaimResult> {
    const where = {
      actorId: scope.actorId,
      route: scope.route,
      idempotencyKey: scope.key,
    };
    const expiry = new Date(now.getTime() - IDEMPOTENCY_KEY_TTL_MS);
    await this.orm.em.fork().nativeDelete(IdempotencyKey, { ...where, createdAt: { $lt: expiry } });
    // The row can vanish between the failed insert and the read (the first request failed and released
    // it, or the purge ran), so a miss claims again instead of reporting a conflict that no longer exists.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const em = this.orm.em.fork();
        const row = em.create(IdempotencyKey, { ...where, requestHash, createdAt: now });
        await em.flush();
        return { claimed: true, id: row.id };
      } catch (error) {
        if (!(error instanceof UniqueConstraintViolationException)) throw error;
      }
      const existing = await this.orm.em.fork().findOne(IdempotencyKey, where);
      if (existing) {
        return {
          claimed: false,
          existing: {
            id: existing.id,
            requestHash: existing.requestHash,
            responseStatus: existing.responseStatus ?? null,
            responseBody: existing.responseBody ?? null,
            createdAt: existing.createdAt,
          },
        };
      }
    }
    throw new Error('idempotency key claim kept racing with its release');
  }

  /** Stores the response of the request that holds the claim. */
  async complete(id: string, status: number, body: unknown): Promise<void> {
    await this.orm.em
      .fork()
      .nativeUpdate(IdempotencyKey, { id }, { responseStatus: status, responseBody: body ?? null });
  }

  /** Drops a claim that never produced a stored response (the handler failed); only a pending row goes. */
  async release(id: string): Promise<void> {
    await this.orm.em.fork().nativeDelete(IdempotencyKey, { id, responseStatus: null });
  }
}
