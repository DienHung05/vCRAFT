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

  it('stops for good only when the API has no live endpoint', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const status = await new Promise<LiveStatus>((resolve) => {
      subscribeLiveEvents({
        getAccessToken: async () => 'tok',
        onEvent: () => undefined,
        onStatus: (s) => s === 'polling' && resolve(s),
        fetch: fetchImpl,
      });
    });
    expect(status).toBe('polling');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries after a 401 and reconnects once a token is available, reading it again each time', async () => {
    const tokens = [null, 'stale', 'fresh'];
    let t = 0;
    const getAccessToken = vi.fn(async () => (t < tokens.length ? (tokens[t++] ?? null) : 'fresh'));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValue(sse('data: {"type":"ready","retryMs":2000}\n\n'));
    const statuses: LiveStatus[] = [];
    const waits: number[] = [];
    await new Promise<void>((resolve) => {
      const stop = subscribeLiveEvents({
        getAccessToken,
        onEvent: (e) => {
          if (e.type === 'ready') {
            stop();
            resolve();
          }
        },
        onStatus: (s) => statuses.push(s),
        fetch: fetchImpl,
        sleep: async (ms) => {
          waits.push(ms);
        },
        random: () => 0.5,
      });
    });
    expect(getAccessToken).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1].headers.authorization).toBe('Bearer fresh');
    expect(waits).toEqual([1000, 2000]);
    expect(statuses).toContain('polling');
    expect(statuses.at(-1)).toBe('live');
  });

  it('backs off while the session is missing, growing then capping at 60 s', async () => {
    const waits: number[] = [];
    const fetchImpl = vi.fn();
    await new Promise<void>((resolve) => {
      const stop = subscribeLiveEvents({
        getAccessToken: async () => null,
        onEvent: () => undefined,
        fetch: fetchImpl,
        sleep: async (ms) => {
          waits.push(ms);
          if (waits.length === 10) {
            stop();
            resolve();
          }
        },
        random: () => 0.5,
      });
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(waits.slice(0, 6)).toEqual([1000, 2000, 4000, 8000, 16000, 32000]);
    expect(waits.slice(6)).toEqual([60000, 60000, 60000, 60000]);
  });

  it('caps the backoff at the given limit', () => {
    expect(backoffMs(20, () => 0.5, 60_000)).toBe(60_000);
  });
});
