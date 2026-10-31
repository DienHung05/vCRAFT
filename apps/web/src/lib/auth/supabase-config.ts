export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * Kết nối Supabase Auth của trình duyệt, proxy và server. Phải đọc `process.env.NEXT_PUBLIC_*` theo
 * tên viết thẳng để Next nhúng giá trị lúc build. Thiếu cấu hình thì trả `null`: giao diện nói rõ
 * "chưa cấu hình" thay vì ném lỗi.
 */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}
