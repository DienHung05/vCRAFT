'use client';

import { useEffect, useState } from 'react';
import { browserSupabase } from '@/lib/auth/supabase-browser';

/** Lấy token từ phiên Supabase sẵn có của trình duyệt; thiếu cấu hình thì `null`. */
export function browserAccessToken(): (() => Promise<string | null>) | null {
  const supabase = browserSupabase();
  if (!supabase) return null;
  return async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };
}

/**
 * Dựng client API của màn có phiên chỉ sau khi đã ở trình duyệt; test truyền sẵn `provided`.
 * Không có cấu hình phiên thì `client = null` và màn hình mời đăng nhập.
 */
export function useLiveClient<C>(
  provided: C | undefined,
  create: (getAccessToken: () => Promise<string | null>) => C,
): { client: C | null; loading: boolean } {
  const [state, setState] = useState<{ client: C | null; loading: boolean }>({
    client: provided ?? null,
    loading: provided === undefined,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: `create` là hàm tĩnh; chỉ dựng client một lần.
  useEffect(() => {
    if (provided !== undefined) return;
    const getAccessToken = browserAccessToken();
    setState({ client: getAccessToken ? create(getAccessToken) : null, loading: false });
  }, [provided]);
  return state;
}
