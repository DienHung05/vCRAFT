import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from './support/test-app.js';
import { startTestDatabase, type TestDatabase, testDriver } from './support/test-database.js';

/**
 * vCRAFT-83g.45 — the API must never wedge silently. Incident: after a burst of traffic every DB-backed request
 * hung until the client gave up while `/health` kept answering 200; only a restart helped. These tests drive the
 * real app over HTTP against a real database with a tiny pool, and check that (a) aborted requests do not leak
 * connections, (b) a silently dead link turns into fast 503s and heals on its own, (c) `/health/ready` reports it.
 */
describe('Database pool recovery', () => {
  let db: TestDatabase;
  let t: TestApp;
  let baseUrl: string;

  beforeAll(async () => {
    db = await startTestDatabase({
      proxy: true,
      // Tiny pool and short waits so the failure modes show up within a test's time budget.
      env: {
        DB_POOL_MAX: '2',
        DB_POOL_ACQUIRE_TIMEOUT_MS: '500',
        DB_QUERY_TIMEOUT_MS: '1000',
        HEALTH_READY_TIMEOUT_MS: '1500',
      },
    });
    await db.migrate();
    t = await startTestApp(db);
    await t.app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = `http://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}/api/v1`;
  });

  afterAll(async () => {
    await t?.close();
    await db?.stop();
  });

  async function get(path: string, timeoutMs = 10_000) {
    const started = performance.now();
    try {
      const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();
      return {
        status: res.status,
        body: text ? JSON.parse(text) : undefined,
        ms: performance.now() - started,
      };
    } catch (error) {
      return { status: 0, body: undefined, ms: performance.now() - started, error };
    }
  }

  it('reports readiness through a bounded select 1 on the request pool', async () => {
    const res = await get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: { status: 'up' } });
    if (testDriver === 'postgresql') {
      expect(res.body.pool).toMatchObject({ max: 2 });
    }
  });

  it('keeps serving after a storm of requests the client aborts mid-flight', async () => {
    // Pool of 2, 60 requests, most cancelled after a few ms: every cancelled request must hand its connection back.
    const storm = Array.from({ length: 60 }, (_unused, i) =>
      fetch(`${baseUrl}/products?limit=1`, {
        signal: AbortSignal.timeout(i % 5 === 0 ? 10_000 : 1 + (i % 7)),
      }).then(
        (res) => res.text(),
        () => undefined,
      ),
    );
    await Promise.all(storm);

    for (let i = 0; i < 5; i++) {
      const res = await get('/products?limit=1', 3_000);
      expect(res.status).toBe(200);
    }
    const ready = await get('/health/ready');
    expect(ready.status).toBe(200);
    if (testDriver === 'postgresql') {
      expect(ready.body.pool.waiting).toBe(0);
      expect(ready.body.pool.total).toBeLessThanOrEqual(2);
    }
  });

  // The query guard and the acquire timeout are implemented for `pg`; mysql2 has no per-pool hook for them.
  it.runIf(testDriver === 'postgresql')(
    'answers 503 quickly while the database link is silently dead, then heals without a restart',
    async () => {
      // Warm the pool so its connections exist when the link dies (the real incident: busy, then silent).
      for (let i = 0; i < 4; i++) expect((await get('/products?limit=1')).status).toBe(200);

      db.proxy?.blackhole();
      const during = await Promise.all(
        Array.from({ length: 6 }, () => get('/products?limit=1', 8_000)),
      );
      for (const res of during) {
        expect(res.status, `request should fail fast, took ${Math.round(res.ms)} ms`).toBe(503);
        expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
        expect(res.ms).toBeLessThan(5_000);
      }
      // Liveness is independent of the database; readiness is not.
      expect((await get('/health')).status).toBe(200);
      const notReady = await get('/health/ready');
      expect(notReady.status).toBe(503);

      db.proxy?.revive();
      const deadline = Date.now() + 8_000;
      let status = 0;
      while (Date.now() < deadline && status !== 200) {
        status = (await get('/products?limit=1', 3_000)).status;
        if (status !== 200) await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(status).toBe(200);
      expect((await get('/health/ready')).status).toBe(200);
    },
    40_000,
  );
});
