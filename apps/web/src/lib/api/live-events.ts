'use client';

import { type LiveStatus, subscribeLiveEvents } from '@vcraft/api-client';
import type { LiveEvent } from '@vcraft/contracts';
import { useEffect, useRef, useState } from 'react';
import { browserSupabase } from '@/lib/auth/supabase-browser';

type Listener = (event: LiveEvent) => void;

// One connection per tab, shared by every live view on the page (bell, quotation screens).
const listeners = new Set<Listener>();
const statusListeners = new Set<(status: LiveStatus) => void>();
let current: LiveStatus = 'polling';
let stop: (() => void) | null = null;

function setStatus(status: LiveStatus) {
  current = status;
  for (const listener of statusListeners) listener(status);
}

function connect() {
  const supabase = browserSupabase();
  if (!supabase) return setStatus('polling');
  const stream = subscribeLiveEvents({
    getAccessToken: async () =>
      (await supabase.auth.getSession()).data.session?.access_token ?? null,
    onEvent: (event) => {
      for (const listener of listeners) listener(event);
    },
    onStatus: setStatus,
  });
  // A new session (sign-in, refreshed or switched account) restarts the stream at once instead of
  // waiting for its retry backoff. The initial event only reports the session already in use.
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || !stop) return;
    stop();
    stop = null;
    connect();
  });
  stop = () => {
    data.subscription.unsubscribe();
    stream();
  };
}

/**
 * Live updates from `GET /me/events` (GH#93). `onEvent` sees every event; the returned status says
 * whether the stream is up, so callers can slow their polling while it is and keep it as the fallback.
 */
export function useLiveEvents(onEvent: Listener): LiveStatus {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const [status, setLocal] = useState<LiveStatus>(current);

  useEffect(() => {
    const listener: Listener = (event) => handler.current(event);
    listeners.add(listener);
    statusListeners.add(setLocal);
    if (!stop) connect();
    setLocal(current);
    return () => {
      listeners.delete(listener);
      statusListeners.delete(setLocal);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
        current = 'polling';
      }
    };
  }, []);

  return status;
}
