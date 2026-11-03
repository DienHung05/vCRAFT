import { describe, expect, it, vi } from 'vitest';
import {
  backoffMs,
  createLiveEventParser,
  type LiveStatus,
  subscribeLiveEvents,
} from '../src/realtime/live-events';

const sse = (...lines: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(lines.join('')));
        controller.close();
      },
    }),
  );

describe('live events (GH#93)', () => {
  it('parses events across chunks and skips heartbeats and junk', () => {
    const parse = createLiveEventParser();
    const text = `retry: 2000\ndata: {"type":"ready","retryMs":2000}\n\n: ping\n\ndata: {bad\n\ndata: {"type":"notifications","unreadCount":3}\n\n`;
    expect([...parse(text.slice(0, 25)), ...parse(text.slice(25))]).toEqual([
      { type: 'ready', retryMs: 2000 },
      { type: 'notifications', unreadCount: 3 },
    ]);
  });

  it('backs off exponentially up to 30 s', () => {
    expect(backoffMs(1, () => 0.5)).toBe(1000);
    expect(backoffMs(3, () => 0.5)).toBe(4000);
    expect(backoffMs(20, () => 0.5)).toBe(30000);
  });

  it('delivers events with the bearer token and falls back to polling after repeated failures', async () => {
    const events: unknown[] = [];
    const statuses: LiveStatus[] = [];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        sse('data: {"type":"ready","retryMs":2000}\n\n', 'data: {"type":"activity","at":"x"}\n\n'),
      )
      .mockRejectedValue(new TypeError('network down'));
    let waits = 0;
    const done = new Promise<void>((resolve) => {
      const stop = subscribeLiveEvents({
        getAccessToken: async () => 'tok',
        onEvent: (e) => events.push(e),
        onStatus: (s) => {
          statuses.push(s);
          if (s === 'polling') {
            stop();
            resolve();
          }
        },
        fetch: fetchImpl,
        sleep: async () => {
          waits++;
        },
        random: () => 0.5,
      });
    });
    await done;
    expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBe('Bearer tok');
    expect(events).toEqual([
      { type: 'ready', retryMs: 2000 },
      { type: 'activity', at: 'x' },
    ]);
    expect(statuses).toContain('live');
    expect(statuses.at(-1)).toBe('polling');
    expect(waits).toBeGreaterThanOrEqual(2);
  });

  it('leaves the caller polling when the API has no live endpoint or the session is gone', async () => {
    for (const response of [new Response('', { status: 404 }), new Response('', { status: 401 })]) {
      const status = await new Promise<LiveStatus>((resolve) => {
        subscribeLiveEvents({
          getAccessToken: async () => 'tok',
          onEvent: () => undefined,
          onStatus: (s) => s === 'polling' && resolve(s),
          fetch: vi.fn().mockResolvedValue(response),
        });
      });
      expect(status).toBe('polling');
    }
    const signedOut = vi.fn();
    await new Promise<void>((resolve) => {
      subscribeLiveEvents({
        getAccessToken: async () => null,
        onEvent: () => undefined,
        onStatus: (s) => s === 'polling' && resolve(),
        fetch: signedOut,
      });
    });
    expect(signedOut).not.toHaveBeenCalled();
  });
});
