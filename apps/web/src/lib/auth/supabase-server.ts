import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { isHttpsProto, withSecureOnHttps } from '../secure-cookies';
import { readRememberPreference, withRememberPolicy } from './remember';
import { supabaseConfig } from './supabase-config';

/**
 * Client Supabase cho Server Component và Route Handler, đọc/ghi phiên qua cookie của request.
 * Server Component không ghi được cookie (lỗi bị nuốt): việc làm mới phiên do `proxy.ts` lo.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const store = await cookies();
  const https = isHttpsProto((await headers()).get('x-forwarded-proto'));
  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          // Not remembered: the auth cookies become session cookies (see ./remember).
          const remember = readRememberPreference(store.getAll());
          for (const { name, value, options } of list)
            store.set(
              name,
              value,
              withSecureOnHttps(withRememberPolicy(options, remember), https) ?? {},
            );
        } catch {
          // Gọi từ Server Component: bỏ qua, proxy.ts đã làm mới phiên cho request này.
        }
      },
    },
  });
}
