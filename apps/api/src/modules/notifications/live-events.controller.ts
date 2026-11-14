import { Readable } from 'node:stream';
import { Controller, Get, Req, Res } from '@nestjs/common';
import type { LiveEvent } from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { MediaService } from '../media/application/media.service';
import { LiveSignal } from './application/live-signal';
import { NotificationsService } from './application/notifications.service';

/** How often the stream looks for changes, keeps the proxy awake, and hands the client back to reconnect. */
export const LIVE_CHECK_MS = 3_000;
export const LIVE_HEARTBEAT_MS = 15_000;
// The web reaches the API through the Vercel rewrite, which cuts a response after about 30 s (docs/operations/deploy.md
// §7), so each stream ends just before that and the client reconnects at once: updates still arrive within
// a few seconds. `LIVE_EVENTS_MAX_MS` raises it where nothing sits in between.
export const LIVE_MAX_MS = 25_000;
const liveMaxMs = () => Number(process.env.LIVE_EVENTS_MAX_MS) || LIVE_MAX_MS;
const RETRY_MS = 2_000;

interface StreamRequest extends HttpRequest {
  readonly raw: { once(event: 'close', listener: () => void): unknown };
}

/** After a wake, how long to gather further wakes before looking, so a burst of writes costs one query. */
export const LIVE_WAKE_DEBOUNCE_MS = 50;

/** Resolves after `ms` or as soon as `signal` aborts; leaves no timer or listener behind either way. */
export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Turns the wake subscription into the wait between two checks. A wake that lands while a check is
 * running is remembered, so the next wait ends at once instead of after the whole interval.
 */
function wakeGate(wake: (listener: () => void) => () => void) {
  let woken = false;
  let interrupt: (() => void) | null = null;
  const unsubscribe = wake(() => {
    woken = true;
    interrupt?.();
  });
  return {
    /** Resolves after `ms`, on abort, or `debounceMs` after a wake (which gathers a burst into one check). */
    async wait(ms: number, signal: AbortSignal, debounceMs: number): Promise<void> {
      if (!woken) {
        const interrupted = new AbortController();
        interrupt = () => interrupted.abort();
        try {
          await sleep(ms, AbortSignal.any([signal, interrupted.signal]));
        } finally {
          interrupt = null;
        }
      }
      if (woken && !signal.aborted) await sleep(debounceMs, signal);
      // Cleared before the check runs, so a notice committed during it wakes the next wait.
      woken = false;
    },
    close: unsubscribe,
  };
}

/**
 * One account's live stream as SSE lines: a `ready` event, then `notifications` and `activity` whenever
 * the account's notices change, with a comment line as heartbeat. It checks the database every few
 * seconds, so it sees notices written by any API instance or by the worker, and ends after `LIVE_MAX_MS`
 * so connections recycle; the client reconnects right away, with backoff only after failures.
 * `wake` (optional, GH#537) subscribes to "a notice was just committed on this instance": the stream then
 * checks about `LIVE_WAKE_DEBOUNCE_MS` later instead of waiting out the interval; the poll stays the
 * safety net for other instances and the worker.
 * `media` (optional) is asked on every check for photos that finished processing: each becomes a
 * `media.updated` event (GH#252). Like `pulse`, a failing call is skipped until the next check.
 */
export async function* liveStream(
  pulse: () => Promise<{ unread: number; latest: string | null }>,
  signal: AbortSignal,
  timing = { check: LIVE_CHECK_MS, heartbeat: LIVE_HEARTBEAT_MS, max: LIVE_MAX_MS },
  media?: () => Promise<LiveEvent[]>,
  wake?: (listener: () => void) => () => void,
): AsyncGenerator<string> {
  const line = (event: LiveEvent) => `data: ${JSON.stringify(event)}\n\n`;
  const started = Date.now();
  yield `retry: ${RETRY_MS}\n${line({ type: 'ready', retryMs: RETRY_MS })}`;
  const gate = wake && wakeGate(wake);
  try {
    let last = await pulse();
    yield line({ type: 'notifications', unreadCount: last.unread });
    let quiet = 0;
    while (!signal.aborted && Date.now() - started < timing.max) {
      await (gate
        ? gate.wait(timing.check, signal, LIVE_WAKE_DEBOUNCE_MS)
        : sleep(timing.check, signal));
      if (signal.aborted) return;
      const next = await pulse().catch(() => last);
      let sent = false;
      if (next.unread !== last.unread) {
        yield line({ type: 'notifications', unreadCount: next.unread });
        sent = true;
      }
      if (next.latest && next.latest !== last.latest) {
        yield line({ type: 'activity', at: next.latest });
        sent = true;
      }
      last = next;
      for (const event of (await media?.().catch(() => [])) ?? []) {
        yield line(event);
        sent = true;
      }
      quiet = sent ? 0 : quiet + timing.check;
      if (quiet >= timing.heartbeat) {
        yield ': ping\n\n';
        quiet = 0;
      }
    }
  } finally {
    gate?.close();
  }
}

/** `GET /me/events` (GH#93): live updates for the bell and the live quotation screens. */
@Controller('me/events')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class LiveEventsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly signal: LiveSignal,
  ) {}

  @Get()
  stream(@CurrentActor() actor: Actor, @Req() request: StreamRequest, @Res() reply: HttpReply) {
    const aborted = new AbortController();
    request.raw.once('close', () => aborted.abort());
    const body = Readable.from(
      liveStream(
        () => this.notifications.pulse(actor),
        aborted.signal,
        {
          check: LIVE_CHECK_MS,
          heartbeat: LIVE_HEARTBEAT_MS,
          max: liveMaxMs(),
        },
        this.media.liveUpdates(actor.id),
        (listener) => this.signal.subscribe(actor.id, listener),
      ),
    );
    return reply
      .status(200)
      .header('Content-Type', 'text/event-stream; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-transform')
      .header('X-Accel-Buffering', 'no')
      .send(body);
  }
}
