import { describe, expect, it } from 'vitest';
import { liveStream } from './live-events.controller';

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
