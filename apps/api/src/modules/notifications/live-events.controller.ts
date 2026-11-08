import { Readable } from 'node:stream';
import { Controller, Get, Req, Res } from '@nestjs/common';
import type { LiveEvent } from '@vcraft/contracts';
import { type Actor, CurrentActor, Roles } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
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

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * One account's live stream as SSE lines: a `ready` event, then `notifications` and `activity` whenever
 * the account's notices change, with a comment line as heartbeat. It checks the database every few
 * seconds, so it sees notices written by any API instance or by the worker, and ends after `LIVE_MAX_MS`
 * so connections recycle; the client reconnects right away, with backoff only after failures.
 */
export async function* liveStream(
  pulse: () => Promise<{ unread: number; latest: string | null }>,
  signal: AbortSignal,
  timing = { check: LIVE_CHECK_MS, heartbeat: LIVE_HEARTBEAT_MS, max: LIVE_MAX_MS },
): AsyncGenerator<string> {
  const line = (event: LiveEvent) => `data: ${JSON.stringify(event)}\n\n`;
  const started = Date.now();
  yield `retry: ${RETRY_MS}\n${line({ type: 'ready', retryMs: RETRY_MS })}`;
  let last = await pulse();
  yield line({ type: 'notifications', unreadCount: last.unread });
  let quiet = 0;
  while (!signal.aborted && Date.now() - started < timing.max) {
    await sleep(timing.check, signal);
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
    quiet = sent ? 0 : quiet + timing.check;
    if (quiet >= timing.heartbeat) {
      yield ': ping\n\n';
      quiet = 0;
    }
  }
}

/** `GET /me/events` (GH#93): live updates for the bell and the live quotation screens. */
@Controller('me/events')
@Roles('BUYER', 'ADMIN', 'HOUSEHOLD')
export class LiveEventsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  stream(@CurrentActor() actor: Actor, @Req() request: StreamRequest, @Res() reply: HttpReply) {
    const aborted = new AbortController();
    request.raw.once('close', () => aborted.abort());
    const body = Readable.from(
      liveStream(() => this.notifications.pulse(actor), aborted.signal, {
        check: LIVE_CHECK_MS,
        heartbeat: LIVE_HEARTBEAT_MS,
        max: liveMaxMs(),
      }),
    );
    return reply
      .status(200)
      .header('Content-Type', 'text/event-stream; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-transform')
      .header('X-Accel-Buffering', 'no')
      .send(body);
  }
}
