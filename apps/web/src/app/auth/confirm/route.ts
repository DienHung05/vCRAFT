import type { EmailOtpType } from '@supabase/supabase-js';
import { defaultLocale } from '@vcraft/i18n';
import type { NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { localeOfPath, safeReturnTo } from '@/lib/auth/return-to';
import { parseLocale, redirectTo } from '@/lib/auth/route-handler';
import { createServerSupabase } from '@/lib/auth/supabase-server';

/**
 * Loại thư xác nhận đi qua route này. `recovery` và `invite` không ở đây: hai loại đó cần người dùng
 * đặt mật khẩu nên trỏ thẳng tới `/dat-lai-mat-khau` và `/chap-nhan-loi-moi`.
 */
const CONFIRM_TYPES: readonly EmailOtpType[] = ['signup', 'email', 'email_change', 'magiclink'];

/**
 * Đích của liên kết xác minh email trong thư (FR-AUTH-01): đổi `token_hash` lấy phiên bằng
 * `verifyOtp`, cookie phiên ghi bởi `@supabase/ssr`, rồi chuyển tới `next` (đã lọc an toàn) hoặc
 * `/auth/continue` để vào trang theo vai trò. Mã hỏng, hết hạn hoặc đã dùng thì về đăng nhập kèm
 * thông báo. Dùng `token_hash` (không phải PKCE) nên bấm liên kết ở thiết bị khác vẫn được.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeReturnTo(searchParams.get('next'));
  const locale = localeOfPath(next) ?? parseLocale(searchParams.get('locale')) ?? defaultLocale;

  const supabase = await createServerSupabase();
  if (supabase && tokenHash && type && CONFIRM_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(next ?? `/auth/continue?locale=${locale}`);
  }
  return redirectTo(`${getPathname({ href: '/dang-nhap', locale })}?error=link_invalid`);
}
