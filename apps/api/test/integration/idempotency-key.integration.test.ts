import { IdempotencyKey, purgeIdempotencyKeys, QuotationRequest } from '@vcraft/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase } from './support/test-database.js';

/** Issue #264 (BR-L5): `Idempotency-Key` on state-changing RFQ POSTs. */
describe('Idempotency-Key', () => {
  let db: TestDatabase;
  let t: TestApp;

  const day = 86_400_000;
  const body = (overrides: object = {}) => ({
    title: 'Logo cups',
    category: 'TABLEWARE',
    budgetMinVnd: 1_000_000,
    budgetMaxVnd: 2_000_000,
    design: '100 cups with a printed logo',
    quantity: 100,
    unit: 'cup',
    destination: 'Hanoi',
    requiredBy: new Date(Date.now() + 20 * day).toISOString(),
    biddingClosesAt: new Date(Date.now() + 5 * day).toISOString(),
    coordinationOptIn: true,
    ...overrides,
  });
  const create = (
    auth: string,
    key: string | undefined,
    payload: object = body(),
  ): ReturnType<TestApp['request']> =>
    t.request({
      method: 'POST',
      url: '/rfqs',
      auth,
      body: payload,
      ...(key !== undefined && { headers: { 'idempotency-key': key } }),
    });
  const countOf = (buyerId: string) =>
    db.orm.em.fork().count(QuotationRequest, { buyer: { id: buyerId } });

  beforeAll(async () => {
    db = await startTestDatabase();
    await db.migrate();
    t = await startTestApp(db);
  }, 120_000);

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  it('creates one request for two POST /rfqs with the same key and returns the same body', async () => {
    const buyer = await t.createUser('BUYER');
    const payload = body();
    const first = await create(buyer.auth, 'key-create-1', payload);
    const second = await create(buyer.auth, 'key-create-1', payload);

    expect(first.status).toBe(201);
    expect(first.headers['idempotent-replayed']).toBeUndefined();
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await countOf(buyer.id)).toBe(1);
  });

  it('treats a body with the same fields in another order as the same request', async () => {
    const buyer = await t.createUser('BUYER');
    const payload = body();
    const first = await create(buyer.auth, 'key-order', payload);
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    const second = await create(buyer.auth, 'key-order', reordered);

    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(await countOf(buyer.id)).toBe(1);
  });

  it('answers 422 IDEMPOTENCY_KEY_REUSED when the same key comes with a different body', async () => {
    const buyer = await t.createUser('BUYER');
    await create(buyer.auth, 'key-reused', body());
    const other = await create(buyer.auth, 'key-reused', body({ quantity: 101 }));

    expect(other.status).toBe(422);
    expect(other.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await countOf(buyer.id)).toBe(1);
  });

  it('scopes a key to the actor', async () => {
    const buyer = await t.createUser('BUYER');
    const other = await t.createUser('BUYER');
    const mine = await create(buyer.auth, 'key-shared');
    const theirs = await create(other.auth, 'key-shared');

    expect(theirs.status).toBe(201);
    expect(theirs.headers['idempotent-replayed']).toBeUndefined();
    expect(theirs.body.id).not.toBe(mine.body.id);
    expect(await countOf(buyer.id)).toBe(1);
    expect(await countOf(other.id)).toBe(1);
  });

  it('scopes a key to the route', async () => {
    const buyer = await t.createUser('BUYER');
    const draft = (await create(buyer.auth, 'key-route')).body;
    const submitted = await t.request({
      method: 'POST',
      url: `/rfqs/${draft.id}/submit`,
      auth: buyer.auth,
      headers: { 'if-match': `"${draft.version}"`, 'idempotency-key': 'key-route' },
    });

    expect(submitted.status).toBe(200);
    expect(submitted.headers['idempotent-replayed']).toBeUndefined();
    expect(submitted.body.status).not.toBe('DRAFT');
  });

  it('creates a request per call when no key is sent', async () => {
    const buyer = await t.createUser('BUYER');
    await create(buyer.auth, undefined);
    await create(buyer.auth, undefined);

    expect(await countOf(buyer.id)).toBe(2);
  });

  it('replays a state change on an existing request instead of failing on its new version', async () => {
    const buyer = await t.createUser('BUYER');
    const draft = (await create(buyer.auth, undefined)).body;
    const submit = () =>
      t.request({
        method: 'POST',
        url: `/rfqs/${draft.id}/submit`,
        auth: buyer.auth,
        headers: { 'if-match': `"${draft.version}"`, 'idempotency-key': 'key-submit' },
      });
    const first = await submit();
    // The version moved on, so a plain retry would be a 409; the key replays the first answer.
    const second = await submit();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
  });

  it('does not store an error: the same key works once the request can succeed', async () => {
    const buyer = await t.createUser('BUYER');
    const draft = (await create(buyer.auth, undefined)).body;
    const submit = (version: number) =>
      t.request({
        method: 'POST',
        url: `/rfqs/${draft.id}/submit`,
        auth: buyer.auth,
        headers: { 'if-match': `"${version}"`, 'idempotency-key': 'key-retry-after-error' },
      });
    const stale = await submit(draft.version + 5);
    const retry = await submit(draft.version);

    expect(stale.status).toBe(409);
    expect(retry.status).toBe(200);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
  });

  it('rejects a malformed key with 422 and runs nothing', async () => {
    const buyer = await t.createUser('BUYER');
    for (const key of ['', 'x'.repeat(256), 'café']) {
      const res = await create(buyer.auth, key);
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
    expect(await countOf(buyer.id)).toBe(0);
  });

  it('runs once when the same key arrives twice at the same time', async () => {
    const buyer = await t.createUser('BUYER');
    const payload = body();
    const [a, b] = await Promise.all([
      create(buyer.auth, 'key-race', payload),
      create(buyer.auth, 'key-race', payload),
    ]);

    expect(await countOf(buyer.id)).toBe(1);
    const statuses = [a.status, b.status].sort();
    // One call ran; the other replayed it, or saw it still running (409) and can retry.
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    if (statuses[1] === 409) {
      expect([a, b].find((r) => r.status === 409)?.body.code).toBe('IDEMPOTENCY_IN_PROGRESS');
    }
  });

  it('ignores a key older than 24 hours and the worker purge removes it', async () => {
    const buyer = await t.createUser('BUYER');
    const first = await create(buyer.auth, 'key-expired');
    await db.orm.em
      .fork()
      .nativeUpdate(
        IdempotencyKey,
        { actorId: buyer.id },
        { createdAt: new Date(Date.now() - 25 * 3_600_000) },
      );

    const again = await create(buyer.auth, 'key-expired');
    expect(again.status).toBe(201);
    expect(again.headers['idempotent-replayed']).toBeUndefined();
    expect(again.body.id).not.toBe(first.body.id);

    await db.orm.em
      .fork()
      .nativeUpdate(
        IdempotencyKey,
        { actorId: buyer.id },
        { createdAt: new Date(Date.now() - 25 * 3_600_000) },
      );
    expect(await purgeIdempotencyKeys(db.orm)).toBeGreaterThanOrEqual(1);
    expect(await db.orm.em.fork().count(IdempotencyKey, { actorId: buyer.id })).toBe(0);
  });
});
