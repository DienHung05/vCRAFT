import type { Locale } from '@vcraft/i18n';
import { headers } from 'next/headers';
import { forbidden, redirect as redirectTo } from 'next/navigation';
import { getPathname, redirect } from '@/i18n/navigation';
import { type Area, decideAccess, landingPath } from './access';
import { PATH_HEADER } from './path-header';
import { safeReturnTo } from './return-to';
import { getViewer, type Viewer } from './viewer';

/** Đường dẫn công khai của request hiện tại (do proxy đặt), đã lọc an toàn; `null` nếu thiếu. */
export async function currentPath(): Promise<string | null> {
  return safeReturnTo((await headers()).get(PATH_HEADER));
}

/**
 * Cổng vào khu vực cho layout (Buyer, Studio, Admin). Trả về người dùng khi được vào; còn lại thì
 * không trả về:
 * - khách → chuyển tới `/dang-nhap?next=<trang đang xem>`;
 * - hộ chưa duyệt (chờ duyệt, bị từ chối) → chỉ được xem trang trạng thái hồ sơ;
 * - sai vai trò hoặc tài khoản bị khóa → `forbidden()` (HTTP 403, trang `forbidden.tsx`).
 * API sập thì ném {@link ViewerUnavailableError} cho `error.tsx` của `[locale]`.
 *
 * Lưu ý: layout không chạy lại khi chuyển trang con bằng điều hướng phía client. Vai trò không đổi
 * giữa các trang con nên đủ dùng; ràng buộc theo từng trang (chỉ trang hồ sơ cho hộ chưa duyệt) dựa
 * vào việc các trang đó không có liên kết sang trang khác của Studio, còn API vẫn ép quyền thật.
 */
export async function requireArea(area: Area, locale: Locale): Promise<Viewer> {
  const [viewer, path] = await Promise.all([getViewer(), currentPath()]);
  const profileHref = '/studio/ho-so';
  const profilePath = getPathname({ href: profileHref, locale });
  const onHouseholdProfile =
    path !== null && path.split(/[?#]/)[0]?.replace(/\/$/, '') === profilePath;

  const decision = decideAccess(viewer, area, { onHouseholdProfile });
  switch (decision.kind) {
    case 'allow':
      return viewer as Viewer;
    case 'sign-in':
      return redirect({
        href: { pathname: '/dang-nhap', ...(path ? { query: { next: path } } : {}) },
        locale,
      });
    case 'household-profile':
      return redirect({ href: profileHref, locale });
    case 'forbidden':
      return forbidden();
  }
}

/**
 * Trang dành cho khách (đăng nhập, đăng ký): người đã đăng nhập không cần thấy lại form, nên được
 * chuyển tới đích quay lại (`next`, đã lọc an toàn) hoặc khu làm việc theo vai trò. API sập thì
 * cứ hiện form, vì vẫn có thể là khách.
 */
export async function redirectIfSignedIn(locale: Locale, next: string | null): Promise<void> {
  const viewer = await getViewer().catch(() => null);
  if (!viewer) return;
  if (next) redirectTo(next);
  redirect({ href: landingPath(viewer.role), locale });
}
