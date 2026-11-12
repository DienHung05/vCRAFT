import { createHash, timingSafeEqual } from 'node:crypto';

/** A scan from the same visitor on the same product is counted once per this window (GH#362). */
export const SCAN_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

type HeaderValue = string | string[] | undefined;

export interface ScanRequestLike {
  ip?: string;
  headers: Readonly<Record<string, HeaderValue>>;
}

const first = (value: HeaderValue): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

/** Constant-time comparison of the shared internal secret; an unset secret never matches. */
export function internalKeyMatches(expected: string | undefined, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(provided).digest();
  return timingSafeEqual(a, b);
}

/**
 * The visitor's address and User-Agent. `/q/<code>` posts the scan from Vercel, so the API sees Vercel's
 * address; the web forwards the real one in `X-Visitor-IP` / `X-Visitor-UA`, honoured only when
 * `X-Internal-Key` matches `INTERNAL_API_KEY`. A request that forwards a visitor without a valid key is the
 * web running without the secret (or a forger): its own address is Vercel's, shared by every visitor, so it
 * gets no identity (`undefined`) and is counted without dedupe instead of being undercounted. Direct clients
 * are identified by their own address and User-Agent.
 */
export function visitorIdentity(
  request: ScanRequestLike,
  internalKey: string | undefined = process.env.INTERNAL_API_KEY,
): string | undefined {
  const trusted = internalKeyMatches(internalKey, first(request.headers['x-internal-key']));
  if (!trusted && first(request.headers['x-visitor-ip'])) return undefined;
  const ip = trusted ? first(request.headers['x-visitor-ip']) || request.ip : request.ip;
  const ua = trusted
    ? first(request.headers['x-visitor-ua'])
    : first(request.headers['user-agent']);
  return `${ip ?? ''}|${ua}`;
}

/**
 * The visitor's User-Agent under the same trust rule as `visitorIdentity`; `undefined` when it cannot be
 * told (forwarded visitor without a valid key). Only used to recognise crawlers (GH#483), never stored.
 */
export function visitorUserAgent(
  request: ScanRequestLike,
  internalKey: string | undefined = process.env.INTERNAL_API_KEY,
): string | undefined {
  const trusted = internalKeyMatches(internalKey, first(request.headers['x-internal-key']));
  if (!trusted && first(request.headers['x-visitor-ip'])) return undefined;
  return trusted ? first(request.headers['x-visitor-ua']) : first(request.headers['user-agent']);
}

/** sha256(code + visitor + Vietnam day): the raw address and User-Agent are never stored (FR-TRC-06). */
export function visitorHash(traceCode: string, identity: string, now = new Date()): string {
  const day = new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
  return createHash('sha256').update(`${traceCode}|${identity}|${day}`).digest('hex');
}
