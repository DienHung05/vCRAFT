import { describe, expect, it, vi } from 'vitest';
import { liveStream, sleep } from './live-events.controller';

const events = (lines: string[]) =>
  lines.flatMap((l) =>
    l
      .split('\n')
      .filter((x) => x.startsWith('data: '))
      .map((x) => JSON.parse(x.slice(6))),
  );

describe('liveStream (GH#93)', () => {
  it('announces itself, then sends only what changed, with heartbeats in between', async () => {
    const pulses = [
      { unread: 1, latest: 'a' },
      { unread: 1, latest: 'a' },
      { unread: 2, latest: 'b' },
      { unread: 2, latest: 'b' },
      { unread: 2, latest: 'b' },
    ];
    let i = 0;
    const out: string[] = [];
    const controller = new AbortController();
    for await (const chunk of liveStream(
      async () => pulses[Math.min(i++, pulses.length - 1)] as { unread: number; latest: string },
      controller.signal,
      { check: 1, heartbeat: 2, max: 5_000 },
    )) {
      out.push(chunk);
      if (chunk.startsWith(': ping')) controller.abort();
    }
    expect(out[0]).toContain('retry: 2000');
    expect(events(out).slice(0, 4)).toEqual([
      { type: 'ready', retryMs: 2000 },
      { type: 'notifications', unreadCount: 1 },
      { type: 'notifications', unreadCount: 2 },
      { type: 'activity', at: 'b' },
    ]);
    expect(out.some((l) => l.startsWith(': ping'))).toBe(true);
  });

  it('ends after its time box so the connection recycles', async () => {
    const out: string[] = [];
    for await (const chunk of liveStream(
      async () => ({ unread: 0, latest: null }),
      new AbortController().signal,
      { check: 2, heartbeat: 1_000, max: 10 },
    ))
      out.push(chunk);
    expect(events(out).map((e) => e.type)).toEqual(['ready', 'notifications']);
  });
});

describe('liveStream media updates (GH#252)', () => {
  const update = (id: string, status: 'READY' | 'FAILED') => ({
    type: 'media.updated' as const,
    id,
    status,
    url: status === 'READY' ? 'https://cdn.test/a.webp' : null,
    variants: [],
    thumbhash: null,
    width: null,
    height: null,
  });

  it('sends each media event the callback returns, and survives a failing check', async () => {
    const batches = [[update('a', 'READY')], 'boom', [update('b', 'FAILED')], []] as const;
    let i = 0;
    const out: string[] = [];
    const controller = new AbortController();
    for await (const chunk of liveStream(
      async () => ({ unread: 0, latest: null }),
      controller.signal,
      { check: 1, heartbeat: 1_000, max: 5_000 },
      async () => {
        const batch = batches[Math.min(i++, batches.length - 1)];
        if (batch === undefined || batch === 'boom') throw new Error('db down');
        return [...batch];
      },
    )) {
      out.push(chunk);
      if (events(out).filter((e) => e.type === 'media.updated').length === 2) controller.abort();
    }
    expect(events(out).filter((e) => e.type === 'media.updated')).toEqual([
      update('a', 'READY'),
      update('b', 'FAILED'),
    ]);
  });
});

describe('sleep abort listener', () => {
  it('leaves no abort listener behind after many sleeps, and clears the timer on abort', async () => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, 'addEventListener');
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    for (let i = 0; i < 5; i++) await sleep(1, controller.signal);
    expect(add).toHaveBeenCalledTimes(5);
    expect(remove).toHaveBeenCalledTimes(5);
    for (const [, listener] of add.mock.calls) {
      expect(remove.mock.calls.some(([, l]) => l === listener)).toBe(true);
    }
    const pending = sleep(60_000, controller.signal);
    controller.abort();
    await expect(pending).resolves.toBeUndefined();
  });
});

describe('liveStream wake-up (GH#537)', () => {
  /** A fake `wake` source: records subscriptions and lets the test fire them. */
  const wakeSource = () => {
    const listeners = new Set<() => void>();
    return {
      listeners,
      wake: (listener: () => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      fire: () => {
        for (const listener of [...listeners]) listener();
      },
    };
  };
  const timing = { check: 60_000, heartbeat: 120_000, max: 120_000 };
  const idle = async () => ({ unread: 0, latest: null as string | null });

  it('checks right after a wake instead of waiting out a long interval, and unsubscribes at the end', async () => {
    const source = wakeSource();
    const pulses = [
      { unread: 0, latest: null as string | null },
      { unread: 1, latest: 'n1' as string | null },
    ];
    let i = 0;
    const controller = new AbortController();
    const out: string[] = [];
    const stream = liveStream(
      async () => pulses[Math.min(i++, pulses.length - 1)] as (typeof pulses)[number],
      controller.signal,
      timing,
      undefined,
      source.wake,
    );
    const started = Date.now();
    const reader = (async () => {
      for await (const chunk of stream) {
        out.push(chunk);
        if (chunk.includes('"activity"')) controller.abort();
      }
    })();
    await vi.waitFor(() => expect(source.listeners.size).toBe(1));
    source.fire();
    await reader;
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(events(out)).toEqual([
      { type: 'ready', retryMs: 2000 },
      { type: 'notifications', unreadCount: 0 },
      { type: 'notifications', unreadCount: 1 },
      { type: 'activity', at: 'n1' },
    ]);
    expect(source.listeners.size).toBe(0);
  });

  it('answers a burst of wakes with a single check', async () => {
    const source = wakeSource();
    let pulses = 0;
    const controller = new AbortController();
    const stream = liveStream(
      async () => ({ unread: pulses++, latest: null }),
      controller.signal,
      timing,
      undefined,
      source.wake,
    );
    const out: string[] = [];
    const reader = (async () => {
      for await (const chunk of stream) {
        out.push(chunk);
        if (events(out).length === 3) controller.abort();
      }
    })();
    await vi.waitFor(() => expect(source.listeners.size).toBe(1));
    source.fire();
    source.fire();
    source.fire();
    await reader;
    // One pulse when the stream opened and one for the whole burst.
    expect(pulses).toBe(2);
  });

  it('remembers a wake that lands while a check is running', async () => {
    const source = wakeSource();
    const controller = new AbortController();
    let calls = 0;
    const stream = liveStream(
      async () => {
        calls++;
        // The notice commits while the second check is querying.
        if (calls === 2) source.fire();
        return { unread: calls, latest: null };
      },
      controller.signal,
      timing,
      undefined,
      source.wake,
    );
    const out: string[] = [];
    const reader = (async () => {
      for await (const chunk of stream) {
        out.push(chunk);
        if (events(out).filter((e) => e.type === 'notifications').length === 3) controller.abort();
      }
    })();
    await vi.waitFor(() => expect(source.listeners.size).toBe(1));
    source.fire();
    await reader;
    expect(calls).toBe(3);
  });

  it('unsubscribes when the client goes away mid-wait', async () => {
    const source = wakeSource();
    const controller = new AbortController();
    const stream = liveStream(idle, controller.signal, timing, undefined, source.wake);
    const reader = (async () => {
      for await (const _ of stream);
    })();
    await vi.waitFor(() => expect(source.listeners.size).toBe(1));
    controller.abort();
    await reader;
    expect(source.listeners.size).toBe(0);
  });

  it('unsubscribes when the consumer stops reading', async () => {
    const source = wakeSource();
    const stream = liveStream(idle, new AbortController().signal, timing, undefined, source.wake);
    await stream.next();
    await stream.next();
    expect(source.listeners.size).toBe(1);
    await stream.return(undefined);
    expect(source.listeners.size).toBe(0);
  });
});
