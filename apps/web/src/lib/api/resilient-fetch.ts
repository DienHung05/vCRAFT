/** Answers worth one more try: rate limit and gateway errors, which an edge or a waking server clears quickly. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export interface ResilientFetchOptions {
  /** Time budget of the first attempt. */
  timeoutMs?: number;
  /** Time budget of the single retry; shorter so the worst case stays bounded. */
  retryTimeoutMs?: number;
  /** Longest pause honoured from `Retry-After` before the retry. */
  maxRetryDelayMs?: number;
  /** Pause when the answer carries no usable `Retry-After`. */
  defaultRetryDelayMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** First attempt 8 s + pause up to 2 s + retry 6 s: at most 16 s before the caller gives up. */
export const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRY_TIMEOUT_MS = 6000;
const DEFAULT_MAX_RETRY_DELAY_MS = 2000;
const DEFAULT_RETRY_DELAY_MS = 300;

/** `Retry-After` in seconds (the HTTP-date form is ignored), clamped to `[0, maxMs]`. */
function retryDelayMs(response: Response | null, options: Required<ResilientFetchOptions>): number {
  const raw = response?.headers.get('retry-after');
  const seconds = raw === null || raw === undefined || raw.trim() === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return options.defaultRetryDelayMs;
  return Math.min(seconds * 1000, options.maxRetryDelayMs);
}

/**
 * A response the caller cannot parse as an API answer: an HTML page (Cloudflare "Just a moment..."
 * challenge, a proxy error) instead of JSON. 204 has no body on purpose; 401 is a real answer.
 */
function isUnexpectedBody(response: Response): boolean {
  if (response.status === 204 || response.status === 401) return false;
  return !(response.headers.get('content-type') ?? '').toLowerCase().includes('json');
}

function needsRetry(response: Response): boolean {
  return RETRYABLE_STATUS.has(response.status) || isUnexpectedBody(response);
}

/**
 * Server-side API call that cannot hang a page and survives one hiccup: every attempt has a time limit,
 * and a network error, timeout, 429/502/503/504 or non-JSON (HTML challenge) answer is tried once more
 * after a short pause. Only idempotent reads are retried. Never throws for an HTTP answer; it throws only
 * when both attempts failed at the network level.
 */
export async function resilientFetch(
  url: string,
  init: RequestInit = {},
  overrides: ResilientFetchOptions = {},
): Promise<Response> {
  const options: Required<ResilientFetchOptions> = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retryTimeoutMs: DEFAULT_RETRY_TIMEOUT_MS,
    maxRetryDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
    defaultRetryDelayMs: DEFAULT_RETRY_DELAY_MS,
    fetch: (input, requestInit) => fetch(input, requestInit),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    ...overrides,
  };
  const attempt = (timeoutMs: number) =>
    options.fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  const idempotent = (init.method ?? 'GET').toUpperCase() === 'GET';

  let first: Response | null = null;
  let firstError: unknown;
  try {
    first = await attempt(options.timeoutMs);
  } catch (error) {
    firstError = error;
  }
  if (first && (!idempotent || !needsRetry(first))) return first;
  if (!first && !idempotent) throw firstError;

  await options.sleep(retryDelayMs(first, options));
  try {
    return await attempt(options.retryTimeoutMs);
  } catch (error) {
    // The first answer, even a bad one, is more useful to the caller than a bare network error.
    if (first) return first;
    throw error;
  }
}
