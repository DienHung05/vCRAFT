import { createHash, timingSafeEqual } from 'node:crypto';
import { isExhibitionTag, MAX_REVALIDATE_TAGS } from '@vcraft/utils';
import { revalidateTag } from 'next/cache';

// Node runtime (`node:crypto`); never cached: every call must reach the handler.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

const reply = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: NO_STORE });

/** Constant-time comparison: both sides are hashed first so the lengths always match. */
function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function bearerToken(header: string | null): string {
  const match = /^Bearer (.+)$/.exec(header ?? '');
  return match?.[1] ?? '';
}

/**
 * `POST /api/revalidate` (ADR-0027): drops cached public exhibition reads by tag, the moment the API
 * says the data changed. The API's worker calls it after a suspension, a withdrawal, an edit, a new
 * journal entry and so on commits.
 *
 * - `Authorization: Bearer <REVALIDATE_SECRET>`; 401 on a missing or wrong secret, 503 while the
 *   secret is not configured (so the route can never be open by accident).
 * - Body `{ tags: string[] }`, at most {@link MAX_REVALIDATE_TAGS}, each `exhibition`, `household:<slug>`,
 *   `product:<slug>` or `trace:<CODE>`; anything else is a 400 and nothing is revalidated.
 * - `{ expire: 0 }`: a stale copy is never served, so a suspended household is gone on the next request.
 *
 * The secret is read per request and is never logged or echoed.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) return reply(503, { error: 'revalidation is not configured' });
  if (!sameSecret(bearerToken(request.headers.get('authorization')), secret)) {
    return reply(401, { error: 'unauthorized' });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: 'body must be JSON' });
  }
  const tags = (body as { tags?: unknown } | null)?.tags;
  if (
    !Array.isArray(tags) ||
    tags.length === 0 ||
    tags.length > MAX_REVALIDATE_TAGS ||
    !tags.every(isExhibitionTag)
  ) {
    return reply(400, { error: `tags must be 1-${MAX_REVALIDATE_TAGS} exhibition tags` });
  }

  const unique = [...new Set(tags)];
  for (const tag of unique) revalidateTag(tag, { expire: 0 });
  return reply(200, { revalidated: unique.length });
}
