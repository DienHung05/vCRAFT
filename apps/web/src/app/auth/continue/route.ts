import { defaultLocale } from '@vcraft/i18n';
import type { NextRequest } from 'next/server';
import { getPathname } from '@/i18n/navigation';
import { landingPath } from '@/lib/auth/access';
import { parseLocale, redirectTo } from '@/lib/auth/route-handler';
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
  return redirectTo(
    getPathname({ href: viewer ? landingPath(viewer.role) : '/dang-nhap', locale }),
  );
}
