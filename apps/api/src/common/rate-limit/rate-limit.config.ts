import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

/** Window of the global limiter, in milliseconds (the throttler takes ms). */
export const RATE_LIMIT_WINDOW_MS = 60_000;
/** Requests a client IP may send per window when `API_RATE_LIMIT_PER_MINUTE` is not set. */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 600;

export interface RateLimitConfig {
  enabled: boolean;
  perMinute: number;
}

/**
 * Reads the global limiter settings (NFR-SEC-04). It is on by default with a generous limit so normal
 * browsing and a demo room behind one NAT never reach it; `API_RATE_LIMIT_ENABLED=false` turns it off.
 */
export function rateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const perMinute = Number(env.API_RATE_LIMIT_PER_MINUTE);
  return {
    enabled: env.API_RATE_LIMIT_ENABLED?.trim().toLowerCase() !== 'false',
    perMinute:
      Number.isInteger(perMinute) && perMinute > 0 ? perMinute : DEFAULT_RATE_LIMIT_PER_MINUTE,
  };
}

/** The throttler is named `default` so its header is a plain `Retry-After` (named ones get a suffix). */

/** Probes must keep answering while a client is limited: the orchestrator should not see a healthy API as down. */
const HEALTH_PATH = /^\/api\/v1\/health(?:\/|$)/;

function isHealthProbe(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{ url?: string }>();
  const path = (request.url ?? '').split('?')[0] ?? '';
  return HEALTH_PATH.test(path);
}

/**
 * Options for `ThrottlerModule`: one per-IP bucket for the whole API. `req.ip` is the real client address
 * when `TRUST_PROXY=true` (see `main.ts`), the same source the sign-in and assistant limits use. A blocked
 * request becomes a 429 problem+json through `ProblemDetailsFilter`, and the guard adds `Retry-After` (the
 * throttler is named `default` because a named one would send `Retry-After-<name>` instead).
 */
export function throttlerOptions(config: RateLimitConfig): ThrottlerModuleOptions {
  return {
    throttlers: [{ name: 'default', ttl: RATE_LIMIT_WINDOW_MS, limit: config.perMinute }],
    skipIf: (context) => !config.enabled || isHealthProbe(context),
    errorMessage: 'Too many requests, try again shortly',
  };
}
