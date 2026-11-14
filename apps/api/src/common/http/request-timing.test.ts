import { describe, expect, it, vi } from 'vitest';
import {
  serverTimingHook,
  slowRequestHook,
  slowRequestThresholdMs,
  type TimedReply,
} from './request-timing';

const reply = (
  elapsedTime: number,
  headers: Record<string, string> = {},
): TimedReply & { sent: Record<string, string> } => {
  const sent: Record<string, string> = {};
  return {
    statusCode: 200,
    elapsedTime,
    sent,
    getHeader: (name) => headers[name.toLowerCase()],
    header: (name, value) => {
      sent[name] = value;
    },
  };
};
const request = { method: 'GET', routeOptions: { url: '/api/v1/households/:id' } };

describe('slow request log (GH#537)', () => {
  it('logs the route pattern, not the raw URL, for a request over the threshold', () => {
    const log = vi.fn();
    const done = vi.fn();
    slowRequestHook(500, log)(request, reply(812.4), done);
    expect(log).toHaveBeenCalledWith('GET /api/v1/households/:id 200 812ms');
    expect(done).toHaveBeenCalled();
  });

  it('stays quiet under the threshold', () => {
    const log = vi.fn();
    slowRequestHook(500, log)(request, reply(120), vi.fn());
    expect(log).not.toHaveBeenCalled();
  });

  it('skips streams, which are long-lived by design', () => {
    const log = vi.fn();
    slowRequestHook(500, log)(
      request,
      reply(25_000, { 'content-type': 'text/event-stream; charset=utf-8' }),
      vi.fn(),
    );
    expect(log).not.toHaveBeenCalled();
  });

  it('names a request that matched no route without echoing its URL', () => {
    const log = vi.fn();
    slowRequestHook(1, log)({ method: 'GET' }, reply(5), vi.fn());
    expect(log).toHaveBeenCalledWith('GET (no route) 200 5ms');
  });

  it('reads the threshold from SLOW_REQUEST_MS with a default of 500', () => {
    expect(slowRequestThresholdMs({})).toBe(500);
    expect(slowRequestThresholdMs({ SLOW_REQUEST_MS: '1200' })).toBe(1200);
    expect(slowRequestThresholdMs({ SLOW_REQUEST_MS: 'abc' })).toBe(500);
  });
});

describe('Server-Timing header (GH#537)', () => {
  it('is added to a normal response', async () => {
    const r = reply(42.46);
    await serverTimingHook()(request, r, 'body');
    expect(r.sent['Server-Timing']).toBe('app;dur=42.5');
  });

  it('is not added to a stream', async () => {
    const r = reply(1, { 'content-type': 'text/event-stream' });
    await serverTimingHook()(request, r, 'body');
    expect(r.sent['Server-Timing']).toBeUndefined();
  });
});
