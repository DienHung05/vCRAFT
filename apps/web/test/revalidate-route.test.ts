// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
vi.mock('next/cache', () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));

import { POST } from '@/app/api/revalidate/route';

const SECRET = 's3cret-value-for-tests';

function call(init: { auth?: string | null; body?: unknown; rawBody?: string }) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.auth !== null && init.auth !== undefined) headers.set('authorization', init.auth);
  const body = init.rawBody ?? JSON.stringify(init.body ?? { tags: ['exhibition'] });
  return POST(new Request('https://web.test/api/revalidate', { method: 'POST', headers, body }));
}

beforeEach(() => {
  vi.stubEnv('REVALIDATE_SECRET', SECRET);
});
afterEach(() => {
  revalidateTag.mockReset();
  vi.unstubAllEnvs();
});

describe('POST /api/revalidate (ADR-0027)', () => {
  it('answers 503 while REVALIDATE_SECRET is unset, even with a header', async () => {
    vi.stubEnv('REVALIDATE_SECRET', '');
    const res = await call({ auth: `Bearer ${SECRET}` });
    expect(res.status).toBe(503);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 401 for a missing header, a wrong secret and a non-bearer scheme', async () => {
    for (const auth of [null, 'Bearer nope', `Basic ${SECRET}`, 'Bearer ', SECRET]) {
      const res = await call({ auth });
      expect(res.status, String(auth)).toBe(401);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('checks the secret before reading the body', async () => {
    const res = await call({ auth: 'Bearer nope', rawBody: 'not json' });
    expect(res.status).toBe(401);
  });

  it('answers 400 for a body that is not JSON, has no tags or has a bad tag', async () => {
    const auth = `Bearer ${SECRET}`;
    const bad: Array<Parameters<typeof call>[0]> = [
      { auth, rawBody: 'not json' },
      { auth, body: {} },
      { auth, body: { tags: [] } },
      { auth, body: { tags: 'exhibition' } },
      { auth, body: { tags: ['exhibition', 'news'] } },
      { auth, body: { tags: ['household:Upper'] } },
      { auth, body: { tags: ['trace:abc'] } },
      { auth, body: { tags: ['exhibition', 7] } },
      { auth, body: { tags: Array.from({ length: 51 }, (_, i) => `product:p-${i}`) } },
    ];
    for (const init of bad) {
      const res = await call(init);
      expect(res.status, JSON.stringify(init.body ?? init.rawBody)).toBe(400);
    }
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('revalidates each distinct tag with an immediate expiry and answers 200', async () => {
    const res = await call({
      auth: `Bearer ${SECRET}`,
      body: {
        tags: [
          'exhibition',
          'household:lo-duc-phat',
          'product:binh-1',
          'trace:DF6P3WZE',
          'exhibition',
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: 4 });
    expect(revalidateTag.mock.calls).toEqual([
      ['exhibition', { expire: 0 }],
      ['household:lo-duc-phat', { expire: 0 }],
      ['product:binh-1', { expire: 0 }],
      ['trace:DF6P3WZE', { expire: 0 }],
    ]);
  });

  it('accepts exactly 50 tags and never caches or echoes the secret', async () => {
    const tags = Array.from({ length: 50 }, (_, i) => `product:p-${i}`);
    const res = await call({ auth: `Bearer ${SECRET}`, body: { tags } });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(JSON.stringify(await res.json())).not.toContain(SECRET);
  });
});
