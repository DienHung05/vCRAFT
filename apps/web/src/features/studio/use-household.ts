'use client';

import { ApiError, createStudioClient, type StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { useCallback, useEffect, useState } from 'react';
import { useLiveClient } from '@/lib/api/live-session';

export type HouseholdState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'not-household' }
  | { kind: 'error' }
  | { kind: 'ready'; household: HouseholdDto; refreshError: boolean };

/** Hồ sơ riêng của hộ cho các màn Studio; phân biệt chưa đăng nhập, chưa có hộ và lỗi tải. */
export function useHousehold(provided?: StudioClient) {
  const { client, loading } = useLiveClient(provided, (getAccessToken) =>
    createStudioClient({ getAccessToken }),
  );
  const [state, setState] = useState<HouseholdState>({ kind: 'loading' });

  const reload = useCallback(async () => {
    if (loading) return;
    if (!client) {
      setState({ kind: 'unauthenticated' });
      return;
    }
    setState((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
    try {
      setState({ kind: 'ready', household: await client.getHousehold(), refreshError: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setState({ kind: 'unauthenticated' });
      else if (error instanceof ApiError && (error.status === 403 || error.status === 404))
        setState({ kind: 'not-household' });
      // A failed refresh must not discard what is already on screen (and the user's drafts).
      else
        setState((current) =>
          current.kind === 'ready' ? { ...current, refreshError: true } : { kind: 'error' },
        );
    }
  }, [client, loading]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { client, state, reload };
}
