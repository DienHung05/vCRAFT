/** Why a server-side API call came back as "unavailable" (kept in Vercel runtime logs). */
export type ApiFailure =
  | { kind: 'http'; status: number }
  | { kind: 'schema'; issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey> }> }
  | { kind: 'error'; error: unknown };

/** Keep only the resource (first path segment): no query values, slugs or codes. */
function resourceOf(path: string): string {
  const [pathname = ''] = path.split('?');
  return `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
}

function describe(failure: ApiFailure): string {
  switch (failure.kind) {
    case 'http':
      return `HTTP ${failure.status}`;
    case 'schema': {
      const paths = failure.issues
        .slice(0, 3)
        .map((issue) => issue.path.map(String).join('.') || '(root)');
      return `schema mismatch at ${paths.join(', ') || '(unknown)'}`;
    }
    case 'error': {
      const { error } = failure;
      const name =
        typeof error === 'object' && error !== null && 'name' in error
          ? String(error.name)
          : typeof error;
      return name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : `error ${name}`;
    }
  }
}

/** One concise warning per failed API call; never logs query values, bodies or issue messages. */
export function logApiFailure(path: string, failure: ApiFailure): void {
  console.warn(`[api] ${resourceOf(path)} unavailable: ${describe(failure)}`);
}
