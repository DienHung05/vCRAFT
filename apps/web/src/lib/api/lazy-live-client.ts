'use client';

import { useEffect, useState } from 'react';
import { hasAuthCookie } from '@/lib/auth/session-cookie';

/**
 * `useLiveClient` for public pages that only matter to a signed-in visitor (village news): the Supabase
 * SDK and the API client load on demand instead of with the page's first-load JS. A guest holds no auth
 * cookie, so nothing is downloaded and `client` stays `null`. Tests pass `provided`.
 */
export function useLazyLiveClient<C>(
  provided: C | undefined,
  create: (getAccessToken: () => Promise<string | null>) => Promise<C>,
): { client: C | null; loading: boolean } {
  const [state, setState] = useState<{ client: C | null; loading: boolean }>({
    client: provided ?? null,
    loading: provided === undefined,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `create` is a static function; the client is built once.
  useEffect(() => {
    if (provided !== undefined) return;
    if (!hasAuthCookie(document.cookie)) {
      setState({ client: null, loading: false });
      return;
    }
    let active = true;
    void import('./live-session')
      .then(async ({ browserAccessToken }) => {
        const getAccessToken = browserAccessToken();
        const client = getAccessToken ? await create(getAccessToken) : null;
        if (active) setState({ client, loading: false });
      })
      .catch(() => {
        if (active) setState({ client: null, loading: false });
      });
    return () => {
      active = false;
    };
  }, [provided]);
  return state;
}
