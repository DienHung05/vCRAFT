import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { catchError, defer, from, mergeMap, type Observable, of, throwError } from 'rxjs';
import type { Actor } from '../auth/auth.guard';
import { AppError } from '../errors/app-error';
import type { HttpReply, HttpRequest } from '../http/http-types';
import { canonicalJson } from './canonical-json';
import { type IdempotencyScope, IdempotencyStore } from './idempotency.store';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

/** A claim with no stored response this old belongs to a request that died; it is taken over. */
export const IN_FLIGHT_TIMEOUT_MS = 2 * 60_000;

/** 1 to 255 printable ASCII characters (space included). */
const KEY_PATTERN = /^[\x20-\x7e]{1,255}$/;

type IdempotentRequest = HttpRequest & {
  method: string;
  body?: unknown;
  actor?: Actor | null;
};
type StatusReply = HttpReply & { statusCode?: number };

/**
 * `Idempotency-Key` for state-changing POSTs (BR-L5, GH#264). The key is claimed before the handler runs,
 * so two concurrent calls cannot both execute it:
 * - first call: runs the handler and stores its 2xx response (errors are not stored, the claim is dropped);
 * - repeat with the same body: replays the stored status and body with `Idempotent-Replayed: true`;
 * - repeat with another body: 422 `IDEMPOTENCY_KEY_REUSED`;
 * - repeat while the first call is still running: 409 `IDEMPOTENCY_IN_PROGRESS`.
 * Keys are scoped to the actor and the route, and expire after 24 h. No header means no change.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly store: IdempotencyStore) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<IdempotentRequest>();
    const reply = http.getResponse<StatusReply>();
    const key = readKey(request.headers[IDEMPOTENCY_KEY_HEADER]);
    const actor = request.actor;
    if (key === undefined || !actor || request.method !== 'POST') return next.handle();

    const scope: IdempotencyScope = {
      actorId: actor.id,
      route: `POST ${pathOf(request.url)}`,
      key,
    };
    const requestHash = createHash('sha256').update(canonicalJson(request.body)).digest('hex');

    return defer(() => from(this.store.claim(scope, requestHash, new Date()))).pipe(
      mergeMap((claim) => {
        if (claim.claimed) return this.run(claim.id, next, reply);
        const { existing } = claim;
        if (existing.requestHash !== requestHash) {
          return throwError(
            () =>
              new AppError(
                'IDEMPOTENCY_KEY_REUSED',
                'This Idempotency-Key was already used with a different request body.',
              ),
          );
        }
        if (existing.responseStatus === null) {
          return this.takeOverOrReject(existing.id, existing.createdAt, scope, requestHash, {
            next,
            reply,
          });
        }
        void reply.header(IDEMPOTENT_REPLAYED_HEADER, 'true');
        void reply.status(existing.responseStatus);
        return of(existing.responseBody);
      }),
    );
  }

  /** Runs the handler under a claim: a 2xx result is stored, anything else frees the key for a retry. */
  private run(id: string, next: CallHandler, reply: StatusReply): Observable<unknown> {
    return next.handle().pipe(
      mergeMap(async (body) => {
        const status = reply.statusCode ?? 200;
        if (status >= 200 && status < 300) {
          // Stored as JSON so a replay carries exactly what the client received the first time.
          await this.store.complete(id, status, toJson(body));
        } else {
          await this.store.release(id);
        }
        return body;
      }),
      catchError((error: unknown) =>
        from(this.store.release(id).catch(() => undefined)).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }

  /** The first call has not answered yet: report it, unless it is old enough to count as dead. */
  private takeOverOrReject(
    id: string,
    createdAt: Date,
    scope: IdempotencyScope,
    requestHash: string,
    handler: { next: CallHandler; reply: StatusReply },
  ): Observable<unknown> {
    if (Date.now() - createdAt.getTime() < IN_FLIGHT_TIMEOUT_MS) {
      return throwError(() => new AppError('IDEMPOTENCY_IN_PROGRESS'));
    }
    return defer(async () => {
      await this.store.release(id);
      return this.store.claim(scope, requestHash, new Date());
    }).pipe(
      mergeMap((claim) =>
        claim.claimed
          ? this.run(claim.id, handler.next, handler.reply)
          : throwError(() => new AppError('IDEMPOTENCY_IN_PROGRESS')),
      ),
    );
  }
}

/** `undefined` when the header is absent; a malformed key is a 422, not a silent pass-through. */
function readKey(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !KEY_PATTERN.test(raw)) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Idempotency-Key must be 1 to 255 printable ASCII characters.',
    );
  }
  return raw;
}

const pathOf = (url: string) => url.split('?')[0] ?? url;

const toJson = (body: unknown): unknown =>
  body === undefined ? null : JSON.parse(JSON.stringify(body));
