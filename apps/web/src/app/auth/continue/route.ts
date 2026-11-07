import { defaultLocale } from '@vcraft/i18n';
import type { NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { landingPathFor } from '@/lib/auth/access';
import {
  hasHouseholdIntent,
  hasUnfinishedHouseholdRegistration,
} from '@/lib/auth/household-intent';
import { safeReturnTo } from '@/lib/auth/return-to';
import { parseLocale, redirectTo } from '@/lib/auth/route-handler';
import { createServerSupabase } from '@/lib/auth/supabase-server';
import { getViewer } from '@/lib/auth/viewer';

/**
 * Bước chuyển sau đăng nhập khi không có đích quay lại: hỏi `GET /me` rồi đưa người dùng tới nơi
 * hợp với vai trò (Buyer về trang chủ, hộ vào hồ sơ hộ, Admin vào điều phối). Chạy ở server nên
 * dùng được địa chỉ API nội bộ. Chưa có phiên thì về đăng nhập; API sập thì về trang chủ.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const locale = parseLocale(request.nextUrl.searchParams.get('locale')) ?? defaultLocale;
  let viewer: Awaited<ReturnType<typeof getViewer>>;
  try {
    viewer = await getViewer();
  } catch {
    return redirectTo(getPathname({ href: '/', locale }));
  }
  if (!viewer) return redirectTo(getPathname({ href: '/dang-nhap', locale }));
  const next = safeReturnTo(request.nextUrl.searchParams.get('next'));
  if (!viewer.username) {
    const target = getPathname({ href: '/chon-ten-dang-nhap', locale });
    return redirectTo(`${target}${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  }
  if (next) return redirectTo(next);
  // GH#180: someone who started household registration resumes the wizard, not the home page.
  let intent = false;
  if (viewer.role === 'BUYER' && !viewer.household) {
    try {
      const supabase = await createServerSupabase();
      const user = (await supabase?.auth.getUser())?.data.user;
      intent = hasHouseholdIntent(user?.user_metadata);
    } catch {
      // Auth unreachable: fall back to the role's landing page.
    }
  }
  return redirectTo(
    getPathname({
      href: landingPathFor(viewer, hasUnfinishedHouseholdRegistration(viewer, intent)),
      locale,
    }),
  );
}
