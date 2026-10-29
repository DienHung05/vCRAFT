import { createBrowserClient } from '@supabase/ssr';
import { createQuotationClient, type QuotationClient } from '@vcraft/api-client';

/**
 * Ứng caller API thật cho màn có phiên đăng nhập: token lấy từ phiên Supabase sẵn có của trình
 * duyệt (biến môi trường `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), người
 * dùng không bao giờ phải dán token vào giao diện. Không có phiên thì trả `null` — UI khi đó ghi
 * nhãn mẫu minh họa thay vì giả vờ đã lưu lên máy chủ.
 */
export function liveQuotationClient(): QuotationClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  const supabase = createBrowserClient(url, publishableKey);
  return createQuotationClient({
    getAccessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}

/** Đang có phiên đăng nhập hay không, để màn live hiển thị đúng trạng thái. */
export async function hasLiveSession(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return false;
  const supabase = createBrowserClient(url, publishableKey);
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}
