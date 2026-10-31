import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseConfig } from './supabase-config';

/**
 * Client Supabase cho Server Component và Route Handler, đọc/ghi phiên qua cookie của request.
 * Server Component không ghi được cookie (lỗi bị nuốt): việc làm mới phiên do `proxy.ts` lo.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Gọi từ Server Component: bỏ qua, proxy.ts đã làm mới phiên cho request này.
        }
      },
    },
  });
}
