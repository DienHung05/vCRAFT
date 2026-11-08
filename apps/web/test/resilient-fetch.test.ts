// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { resilientFetch } from '@/lib/api/resilient-fetch';

const html = (status: number, headers: Record<string, string> = {}) =>
  new Response('<html><title>Just a moment...</title></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  });
const json = (body: unknown, status = 200) => Response.json(body, { status });

function setup(...answers: Array<Response | Error>) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = answers.shift();
    if (!next) throw new Error('unexpected extra call');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async (_ms: number) => {});
  const call = (init: RequestInit = {}) =>
    resilientFetch('http://api/me', init, { fetch: fetchMock as typeof fetch, sleep });
  return { fetchMock, sleep, call };
}

describe('resilientFetch', () => {
  it('returns a good JSON answer without a retry', async () => {
    const { call, fetchMock, sleep } = setup(json({ ok: true }));
    expect((await call()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives every attempt a time limit', async () => {
    const { call, fetchMock } = setup(json({}));
    await call();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('does not retry a 401 problem document', async () => {
    const { call, fetchMock } = setup(json({ code: 'AUTH_UNAUTHENTICATED' }, 401));
    expect((await call()).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([429, 502, 503, 504])(
    'retries once on %i and returns the second answer',
    async (status) => {
      const { call, fetchMock } = setup(json({ code: 'X' }, status), json({ ok: true }));
      expect((await call()).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );

  it('retries an HTML challenge answered with 200 or 403', async () => {
    for (const status of [200, 403]) {
      const { call, fetchMock } = setup(html(status), json({ ok: true }));
      expect((await call()).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it('retries a network error and a timeout', async () => {
    for (const error of [
      new TypeError('fetch failed'),
      new DOMException('timed out', 'TimeoutError'),
    ]) {
      const { call, fetchMock } = setup(error, json({ ok: true }));
      expect((await call()).status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  });

  it('retries only once and then returns the last bad answer', async () => {
    const { call, fetchMock } = setup(html(429), html(429));
    expect((await call()).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when both attempts fail at the network level', async () => {
    const { call, fetchMock } = setup(new TypeError('fetch failed'), new TypeError('again'));
    await expect(call()).rejects.toThrow('again');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the first answer when the retry then fails at the network level', async () => {
    const { call } = setup(html(503), new TypeError('fetch failed'));
    expect((await call()).status).toBe(503);
  });

  it('honours a small Retry-After and caps a large one', async () => {
    const small = setup(html(429, { 'retry-after': '1' }), json({}));
    await small.call();
    expect(small.sleep).toHaveBeenCalledWith(1000);

    const large = setup(html(429, { 'retry-after': '120' }), json({}));
    await large.call();
    expect(large.sleep).toHaveBeenCalledWith(2000);

    const none = setup(html(429), json({}));
    await none.call();
    expect(none.sleep).toHaveBeenCalledWith(300);
  });

  it('never retries a write', async () => {
    const { call, fetchMock } = setup(html(503), json({}));
    expect((await call({ method: 'POST' })).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const failing = setup(new TypeError('fetch failed'));
    await expect(failing.call({ method: 'POST' })).rejects.toThrow('fetch failed');
  });
});
