import type { ErrorCode } from '@vcraft/contracts';

/**
 * Error code for an answer that is not an RFC 9457 problem document: an HTML page from an edge or proxy
 * (Cloudflare "Just a moment..." challenge, a gateway error) or a body that is not JSON at all. The HTTP
 * status still says what happened, so a 429 reads as a rate limit instead of an anonymous internal error;
 * every other status stays `INTERNAL_ERROR` (callers still see `status`).
 */
export function fallbackErrorCode(status: number): ErrorCode {
  return status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR';
}
