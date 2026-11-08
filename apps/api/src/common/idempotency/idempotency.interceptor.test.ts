import { createHash } from 'node:crypto';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error';
import { canonicalJson } from './canonical-json';
import {
  IDEMPOTENT_REPLAYED_HEADER,
  IdempotencyInterceptor,
  IN_FLIGHT_TIMEOUT_MS,
} from './idempotency.interceptor';
import type { ClaimResult, IdempotencyStore } from './idempotency.store';

const ACTOR = { id: '0190f1c0-0000-7000-8000-000000000001' };
/** Hash of the default request body `{ a: 1 }`, as the interceptor computes it. */
const DEFAULT_HASH = createHash('sha256')
  .update(canonicalJson({ a: 1 }))
  .digest('hex');

function setup(options: {
  headers?: Record<string, string | string[]>;
  method?: string;
  body?: unknown;
  actor?: unknown;
  statusCode?: number;
  claims?: ClaimResult[];
}) {
  const claims = [...(options.claims ?? [{ claimed: true, id: 'row-1' } as ClaimResult])];
  const store = {
    claim: vi.fn(async () => claims.shift() as ClaimResult),
    complete: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
  const sent: Record<string, string> = {};
  const reply = {
    statusCode: options.statusCode ?? 201,
    header: vi.fn((name: string, value: string) => {
      sent[name] = value;
      return reply;
    }),
    status: vi.fn((code: number) => {
      reply.statusCode = code;
      return reply;
    }),
    send: vi.fn(),
  };
  const request = {
    method: options.method ?? 'POST',
    url: '/api/v1/rfqs?draft=1',
    headers: options.headers ?? {},
    body: options.body ?? { a: 1 },
    actor: 'actor' in options ? options.actor : ACTOR,
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ExecutionContext;
  const interceptor = new IdempotencyInterceptor(store as unknown as IdempotencyStore);
  const run = (handle: CallHandler['handle']) =>
    firstValueFrom(interceptor.intercept(context, { handle }));
  return { store, reply, sent, run };
}

describe('IdempotencyInterceptor', () => {
  it('lets a request without the header through untouched', async () => {
    const { store, run } = setup({});
    await expect(run(() => of('done'))).resolves.toBe('done');
    expect(store.claim).not.toHaveBeenCalled();
  });

  it('lets a request without an actor through untouched', async () => {
    const { store, run } = setup({ headers: { 'idempotency-key': 'k1' }, actor: null });
    await expect(run(() => of('done'))).resolves.toBe('done');
    expect(store.claim).not.toHaveBeenCalled();
  });

  it('ignores the header on other methods', async () => {
    const { store, run } = setup({ headers: { 'idempotency-key': 'k1' }, method: 'PUT' });
    await expect(run(() => of('done'))).resolves.toBe('done');
    expect(store.claim).not.toHaveBeenCalled();
  });

  it.each(['', 'x'.repeat(256), 'café', 'line\nbreak'])(
    'rejects the malformed key %j with 422',
    (key) => {
      const { run } = setup({ headers: { 'idempotency-key': key } });
      expect(() => run(() => of('done'))).toThrowError(AppError);
    },
  );

  it('accepts a key of 1 and of 255 printable characters', async () => {
    for (const key of ['a', 'k'.repeat(255), 'with space']) {
      const { run } = setup({ headers: { 'idempotency-key': key } });
      await expect(run(() => of('done'))).resolves.toBe('done');
    }
  });

  it('claims the key with the actor, the path without its query and a body hash, then stores a 2xx result', async () => {
    const { store, run } = setup({ headers: { 'idempotency-key': 'k1' }, body: { b: 2, a: 1 } });
    await expect(run(() => of({ id: 'r1' }))).resolves.toEqual({ id: 'r1' });

    const [scope, hash] = store.claim.mock.calls[0] as unknown as [unknown, string];
    expect(scope).toEqual({ actorId: ACTOR.id, route: 'POST /api/v1/rfqs', key: 'k1' });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.complete).toHaveBeenCalledWith('row-1', 201, { id: 'r1' });
  });

  it('hashes equal bodies equally whatever the key order', async () => {
    const hashes: string[] = [];
    for (const body of [
      { a: 1, b: { c: 1, d: 2 } },
      { b: { d: 2, c: 1 }, a: 1 },
    ]) {
      const { store, run } = setup({ headers: { 'idempotency-key': 'k1' }, body });
      await run(() => of('ok'));
      hashes.push((store.claim.mock.calls[0] as unknown as [unknown, string])[1]);
    }
    expect(hashes[0]).toBe(hashes[1]);
    expect(canonicalJson({ b: 1, a: [{ z: 1, y: 2 }] })).toBe('{"a":[{"y":2,"z":1}],"b":1}');
  });

  it('releases the claim and rethrows when the handler fails, storing nothing', async () => {
    const { store, run } = setup({ headers: { 'idempotency-key': 'k1' } });
    const boom = new AppError('STALE_VERSION');
    await expect(run(() => throwError(() => boom))).rejects.toBe(boom);
    expect(store.release).toHaveBeenCalledWith('row-1');
    expect(store.complete).not.toHaveBeenCalled();
  });

  it('replays the stored status and body when the same request comes again', async () => {
    const again = setup({
      headers: { 'idempotency-key': 'k1' },
      claims: [
        {
          claimed: false,
          existing: {
            id: 'row-0',
            requestHash: DEFAULT_HASH,
            responseStatus: 201,
            responseBody: { id: 'r1' },
            createdAt: new Date(),
          },
        },
      ],
    });
    const handler = vi.fn(() => of('never'));
    await expect(again.run(handler)).resolves.toEqual({ id: 'r1' });
    expect(handler).not.toHaveBeenCalled();
    expect(again.sent[IDEMPOTENT_REPLAYED_HEADER]).toBe('true');
    expect(again.reply.status).toHaveBeenCalledWith(201);
  });

  it('answers 422 IDEMPOTENCY_KEY_REUSED when the stored hash is for another body', async () => {
    const { run } = setup({
      headers: { 'idempotency-key': 'k1' },
      claims: [
        {
          claimed: false,
          existing: {
            id: 'row-0',
            requestHash: 'f'.repeat(64),
            responseStatus: 201,
            responseBody: {},
            createdAt: new Date(),
          },
        },
      ],
    });
    await expect(run(() => of('never'))).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('answers 409 IDEMPOTENCY_IN_PROGRESS while the first call is still running', async () => {
    const { store, run } = setup({
      headers: { 'idempotency-key': 'k1' },
      claims: [
        {
          claimed: false,
          existing: {
            id: 'row-0',
            requestHash: DEFAULT_HASH,
            responseStatus: null,
            responseBody: null,
            createdAt: new Date(),
          },
        },
      ],
    });
    await expect(run(() => of('never'))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    });
    expect(store.release).not.toHaveBeenCalled();
  });

  it('takes over a claim whose request died long ago', async () => {
    const { store, run } = setup({
      headers: { 'idempotency-key': 'k1' },
      claims: [
        {
          claimed: false,
          existing: {
            id: 'dead-row',
            requestHash: DEFAULT_HASH,
            responseStatus: null,
            responseBody: null,
            createdAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 1_000),
          },
        },
        { claimed: true, id: 'row-2' },
      ],
    });
    await expect(run(() => of('fresh'))).resolves.toBe('fresh');
    expect(store.release).toHaveBeenCalledWith('dead-row');
    expect(store.complete).toHaveBeenCalledWith('row-2', 201, 'fresh');
  });
});
