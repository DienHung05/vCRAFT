import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAccountClient } from '@vcraft/api-client';
import { supabaseConfig } from './supabase-config';

let cached: SupabaseClient | null | undefined;

/**
 * Client Supabase của trình duyệt: phiên nằm trong cookie `sb-<ref>-auth-token` (định dạng
 * `@supabase/ssr`, khớp cookie e2e chèn vào) và tự làm mới khi access token sắp hết hạn.
 * Mọi mã chạy ở trình duyệt dùng chung một thể hiện này; `null` khi thiếu cấu hình.
 */
export function browserSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const config = supabaseConfig();
  cached = config ? createBrowserClient(config.url, config.publishableKey) : null;
  return cached;
}

/** Caller API (`/api/v1`, cùng origin sau Caddy) mang token của phiên hiện tại. */
export function browserAccountClient() {
  return createAccountClient({
    getAccessToken: async () => {
      const { data } = (await browserSupabase()?.auth.getSession()) ?? { data: null };
      return data?.session?.access_token ?? null;
    },
  });
}
