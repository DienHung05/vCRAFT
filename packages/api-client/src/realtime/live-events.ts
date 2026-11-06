import { type LiveEvent, LiveEventSchema } from '@vcraft/contracts';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'polling';

export interface LiveEventsOptions {
  /** The access token of the current session, or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  onEvent: (event: LiveEvent) => void;
  onStatus?: (status: LiveStatus) => void;
  /** Default `/api/v1/me/events`, same origin as the web. */
  url?: string;
  fetch?: typeof fetch;
  /** Waits injected by tests. */
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

/** Backoff after a failed connection: 1 s, 2 s, 4 s … up to 30 s, with ±20% jitter. */
export function backoffMs(failures: number, random: () => number = Math.random): number {
  const base = Math.min(30_000, 1_000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.8 + 0.4 * random()));
}

/** After this many failures in a row the caller is told to rely on polling; retries continue slowly. */
export const POLLING_AFTER_FAILURES = 3;
const MIN_HEALTHY_MS = 2_000;

/** Splits an SSE byte stream into live events; comments (heartbeats) and malformed lines are skipped. */
export function createLiveEventParser(): (chunk: string) => LiveEvent[] {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: LiveEvent[] = [];
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf('\n\n');
      const data = block
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      try {
        const parsed = LiveEventSchema.safeParse(JSON.parse(data));
        if (parsed.success) events.push(parsed.data);
      } catch {
        // A broken line is skipped; the stream goes on.
      }
    }
    return events;
  };
}

/**
 * Keeps one live connection to `GET /me/events` (GH#93) with `fetch`, which unlike `EventSource` can send
 * the Authorization header. A stream that ends normally reconnects at once; failures back off. A missing
 * endpoint (404, an older API) or a signed-out session stops for good and leaves the caller polling.
 * Returns a function that closes the connection.
 */
export function subscribeLiveEvents(options: LiveEventsOptions): () => void {
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const controller = new AbortController();
  const status = (s: LiveStatus) => options.onStatus?.(s);
  let failures = 0;

  void (async () => {
    status('connecting');
    while (!controller.signal.aborted) {
      let ended = false;
      const opened = Date.now();
      try {
        const token = await options.getAccessToken();
        if (!token) return status('polling');
        const res = await fetchImpl(options.url ?? '/api/v1/me/events', {
          headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 404 || res.status === 401 || res.status === 403)
          return status('polling');
        if (!res.ok || !res.body) throw new Error(`live events ${res.status}`);
        const parse = createLiveEventParser();
        const decoder = new TextDecoder();
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parse(decoder.decode(value, { stream: true }))) {
            if (event.type === 'ready') {
              failures = 0;
              status('live');
            }
            options.onEvent(event);
          }
        }
        // A stream that delivered `ready` and lasted a while ended on purpose; one that closes at once is a
        // failure, so a misbehaving proxy cannot make the client reconnect in a tight loop.
        ended = failures === 0 && Date.now() - opened >= MIN_HEALTHY_MS;
      } catch {
        if (controller.signal.aborted) return;
      }
      if (ended) continue;
      failures++;
      status(failures >= POLLING_AFTER_FAILURES ? 'polling' : 'reconnecting');
      await sleep(backoffMs(failures, options.random));
    }
  })();

  return () => controller.abort();
}
