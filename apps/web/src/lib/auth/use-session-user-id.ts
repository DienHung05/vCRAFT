'use client';

import { useEffect, useState } from 'react';

/**
 * The signed-in person's id from the browser's Supabase session, or null when there is none. `provided`
 * (tests, callers that already know it) skips the lookup.
 */
export function useSessionUserId(provided?: string | null) {
  const [userId, setUserId] = useState<string | null>(provided ?? null);
  const [loading, setLoading] = useState(provided === undefined);
  useEffect(() => {
    if (provided !== undefined) {
      setUserId(provided);
      setLoading(false);
      return;
    }
    let active = true;
    void import('./supabase-browser')
      .then(async ({ browserSupabase }) => {
        const { data } = (await browserSupabase()?.auth.getSession()) ?? { data: null };
        if (active) setUserId(data?.session?.user.id ?? null);
      })
      .catch(() => {
        if (active) setUserId(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [provided]);
  return { userId, loading };
}
