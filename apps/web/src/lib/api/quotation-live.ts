import { createQuotationClient, type QuotationClient } from '@vcraft/api-client';
import { browserSupabase } from '@/lib/auth/supabase-browser';

/**
 * Ứng caller API thật cho màn có phiên đăng nhập: token lấy từ phiên Supabase sẵn có của trình
 * duyệt (client dùng chung ở `lib/auth/supabase-browser`), người dùng không bao giờ phải dán token
 * vào giao diện. Không có phiên thì trả `null` — UI khi đó ghi nhãn mẫu minh họa thay vì giả vờ
 * đã lưu lên máy chủ.
 */
export function liveQuotationClient(): QuotationClient | null {
  const supabase = browserSupabase();
  if (!supabase) return null;
  return createQuotationClient({
    getAccessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}

/** Đang có phiên đăng nhập hay không, để màn live hiển thị đúng trạng thái. */
export async function hasLiveSession(): Promise<boolean> {
  const supabase = browserSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}
