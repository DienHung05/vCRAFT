import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAccountClient } from '@vcraft/api-client';
import { withSecureOnHttps } from '../secure-cookies';
import { readRememberPreference, withRememberPolicy } from './remember';
import { supabaseConfig } from './supabase-config';

/**
 * The same `document.cookie` handling as the `@supabase/ssr` default, plus the remember policy. The
 * preference is read on every write, so changing it right before sign-in needs no new client.
 */
const documentCookies = {
  getAll: () => parseCookieHeader(document.cookie),
  setAll: (
    list: { name: string; value: string; options: Parameters<typeof serializeCookieHeader>[2] }[],
  ) => {
    const remember = readRememberPreference(parseCookieHeader(document.cookie));
    for (const { name, value, options } of list) {
      const header = serializeCookieHeader(
        name,
        value,
        withSecureOnHttps(
          withRememberPolicy(options, remember),
          window.location.protocol === 'https:',
        ) ?? {},
      );
      // biome-ignore lint/suspicious/noDocumentCookie: same synchronous document.cookie write as the @supabase/ssr default, plus the remember policy.
      document.cookie = header;
    }
  },
};

let cached: SupabaseClient | null | undefined;

/**
 * Client Supabase của trình duyệt: phiên nằm trong cookie `sb-<ref>-auth-token` (định dạng
 * `@supabase/ssr`, khớp cookie e2e chèn vào) và tự làm mới khi access token sắp hết hạn.
 * Mọi mã chạy ở trình duyệt dùng chung một thể hiện này; `null` khi thiếu cấu hình.
 */
export function browserSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const config = supabaseConfig();
  cached = config
    ? createBrowserClient(config.url, config.publishableKey, { cookies: documentCookies })
    : null;
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
