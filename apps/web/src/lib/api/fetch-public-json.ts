import { apiBaseUrl } from '@/lib/api/internal-url';
import { logApiFailure } from '@/lib/api/log-api-failure';

export interface JsonSchemaLike<T> {
  safeParse: (
    value: unknown,
  ) =>
    | { success: true; data: T }
    | { success: false; error: { issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> } };
}

export type PublicJsonResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'unavailable' };

export interface FetchPublicJsonOptions {
  /**
   * Data Cache lifetime in seconds. Omit for `cache: 'no-store'`, which is the right choice for a
   * detail read whose item can be retired: Next keeps a stale 200 when the API later answers 404,
   * so a cached detail read could show a withdrawn item forever.
   */
  revalidate?: number;
  /** Path used in log lines; defaults to `path`. Only the first segment is logged. */
  logPath?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 4000;

type Attempt<T> =
  | PublicJsonResult<T>
  | { status: 'invalid'; issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> };

async function attempt<T>(
  path: string,
  schema: JsonSchemaLike<T>,
  cacheInit: RequestInit & { next?: { revalidate: number } },
  logPath: string,
  timeoutMs: number,
): Promise<Attempt<T>> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    headers: { accept: 'application/json' },
    ...cacheInit,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (res.status === 404) return { status: 'not-found' };
  if (!res.ok) {
    logApiFailure(logPath, { kind: 'http', status: res.status });
    return { status: 'unavailable' };
  }
  const parsed = schema.safeParse(await res.json());
  if (parsed.success) return { status: 'ok', data: parsed.data };
  return { status: 'invalid', issues: parsed.error.issues };
}

/**
 * Server-side read of a public API resource, validated with a zod schema.
 *
 * A cached answer that no longer matches the schema (the API contract changed after the entry was
 * stored) is not trusted: it is refetched once with `cache: 'no-store'` and that answer wins
 * (ok, not-found, or `unavailable` when it is still invalid). Without this a stale entry keeps
 * failing validation until it expires or the Data Cache is purged (GH#395).
 */
export async function fetchPublicJson<T>(
  path: string,
  schema: JsonSchemaLike<T>,
  options: FetchPublicJsonOptions = {},
): Promise<PublicJsonResult<T>> {
  const logPath = options.logPath ?? path;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    const cached = options.revalidate !== undefined;
    let result = await attempt(
      path,
      schema,
      cached ? { next: { revalidate: options.revalidate as number } } : { cache: 'no-store' },
      logPath,
      timeoutMs,
    );
    if (result.status === 'invalid' && cached) {
      result = await attempt(path, schema, { cache: 'no-store' }, logPath, timeoutMs);
    }
    if (result.status === 'invalid') {
      logApiFailure(logPath, { kind: 'schema', issues: result.issues });
      return { status: 'unavailable' };
    }
    return result;
  } catch (error) {
    logApiFailure(logPath, { kind: 'error', error });
    return { status: 'unavailable' };
  }
}
