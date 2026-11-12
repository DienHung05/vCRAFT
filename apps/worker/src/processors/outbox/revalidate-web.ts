import { EXHIBITION_TAG, isExhibitionTag, MAX_REVALIDATE_TAGS } from '@vcraft/utils';

/** Where and how the worker tells the web its cached exhibition pages are out of date (ADR-0027). */
export interface WebRevalidateConfig {
  url: string;
  secret: string;
}

/** Delivers one batch of Data Cache tags; throws when the web did not accept them (the outbox retries). */
export type WebRevalidator = (tags: string[]) => Promise<void>;

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * `WEB_REVALIDATE_URL` + `REVALIDATE_SECRET`. Either missing (dev, test, a deploy that has not been set
 * up yet) gives `null`: nothing is sent and the web's 60 s fallback TTL bounds how stale a page can be.
 */
export function webRevalidateFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WebRevalidateConfig | null {
  const url = env.WEB_REVALIDATE_URL?.trim();
  const secret = env.REVALIDATE_SECRET?.trim();
  if (!url || !secret) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  return { url, secret };
}

/** The tags worth sending: valid ones, at most the cap, and `exhibition` when nothing usable is left. */
export function revalidateTagsOf(payload: Record<string, unknown>): string[] {
  const raw = Array.isArray(payload.tags) ? payload.tags : [];
  const valid = raw.filter(isExhibitionTag);
  const tags = [...new Set(valid)];
  if (tags.length === 0 || tags.length > MAX_REVALIDATE_TAGS || valid.length < raw.length) {
    return [EXHIBITION_TAG];
  }
  return tags;
}

/**
 * Builds the revalidator. Without a config it does nothing. The secret goes only into the
 * `Authorization` header and never into an error message or a log line.
 */
export function createWebRevalidator(
  config: WebRevalidateConfig | null,
  fetchImpl: typeof fetch = fetch,
): WebRevalidator {
  return async (tags) => {
    if (!config) return;
    const res = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.secret}` },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`web revalidate answered HTTP ${res.status}`);
  };
}
