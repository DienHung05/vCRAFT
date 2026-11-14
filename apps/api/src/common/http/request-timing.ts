/** Requests slower than this are logged (`SLOW_REQUEST_MS`, GH#537). */
export const SLOW_REQUEST_DEFAULT_MS = 500;

export const slowRequestThresholdMs = (
  env: Readonly<Record<string, string | undefined>> = process.env,
) => {
  const value = Number(env.SLOW_REQUEST_MS);
  return Number.isFinite(value) && value > 0 ? value : SLOW_REQUEST_DEFAULT_MS;
};

/** The parts of a Fastify request and reply the timing hooks read. */
export interface TimedRequest {
  readonly method: string;
  /** The route pattern (`/api/v1/households/:id`); missing when no route matched. */
  readonly routeOptions?: { readonly url?: string | undefined };
}
export interface TimedReply {
  readonly statusCode: number;
  /** Milliseconds since Fastify received the request. */
  readonly elapsedTime: number;
  getHeader(name: string): unknown;
  header(name: string, value: string): unknown;
}

/** Streams (live events, the assistant) stay open by design, so their duration says nothing about slowness. */
const isStream = (reply: TimedReply) =>
  String(reply.getHeader('content-type') ?? '').startsWith('text/event-stream');

/**
 * `onSend` hook: adds `Server-Timing: app;dur=<ms>` so a browser's network panel shows the API's own
 * time. Skipped for streams, whose headers go out long before the response ends.
 */
export const serverTimingHook =
  () => (_request: TimedRequest, reply: TimedReply, payload: unknown) => {
    if (!isStream(reply)) reply.header('Server-Timing', `app;dur=${reply.elapsedTime.toFixed(1)}`);
    return Promise.resolve(payload);
  };

/**
 * `onResponse` hook: logs `METHOD route status durationMs` for a request slower than `thresholdMs`. It
 * logs the route pattern, never the raw URL, so ids and query strings (which can carry personal data)
 * stay out of the logs.
 */
export const slowRequestHook =
  (thresholdMs: number, log: (message: string) => void) =>
  (request: TimedRequest, reply: TimedReply, done: () => void) => {
    if (reply.elapsedTime >= thresholdMs && !isStream(reply)) {
      const route = request.routeOptions?.url ?? '(no route)';
      log(`${request.method} ${route} ${reply.statusCode} ${Math.round(reply.elapsedTime)}ms`);
    }
    done();
  };
