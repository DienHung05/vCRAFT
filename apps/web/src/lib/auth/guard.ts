import type { Locale } from '@vcraft/i18n';
import { headers } from 'next/headers';
import { forbidden, redirect as redirectTo } from 'next/navigation';
import { getPathname, redirect } from '@/i18n/navigation';
import { type Area, decideAccess, landingPath } from './access';
import { PATH_HEADER } from './path-header';
import { safeReturnTo } from './return-to';
import { getViewerState, type Viewer } from './viewer';

/** Đường dẫn công khai của request hiện tại (do proxy đặt), đã lọc an toàn; `null` nếu thiếu. */
export async function currentPath(): Promise<string | null> {
  return safeReturnTo((await headers()).get(PATH_HEADER));
}

/** All signed-in entry points preserve their destination while the account chooses its username. */
function requireUsername(viewer: Viewer | null, locale: Locale, next: string | null): void {
  if (viewer?.username === null) {
    redirect({
      href: { pathname: '/chon-ten-dang-nhap', ...(next ? { query: { next } } : {}) },
      locale,
    });
  }
}

/**
 * Cổng vào khu vực cho layout (Buyer, Studio, Admin). Trả về người dùng khi được vào; còn lại thì
 * không trả về:
 * - khách → chuyển tới `/dang-nhap?next=<trang đang xem>`;
 * - hộ chưa duyệt (chờ duyệt, bị từ chối) → chỉ được xem trang trạng thái hồ sơ;
 * - sai vai trò hoặc tài khoản bị khóa → `forbidden()` (HTTP 403, trang `forbidden.tsx`).
 * Returns `null` when the API could not say who is signed in (slow, rate limited, HTML challenge page):
 * the layout must then render {@link SessionUnavailable} instead of throwing, so the page stays HTTP 200
 * and the visitor can retry.
 *
 * Lưu ý: layout không chạy lại khi chuyển trang con bằng điều hướng phía client. Vai trò không đổi
 * giữa các trang con nên đủ dùng; ràng buộc theo từng trang (chỉ trang hồ sơ cho hộ chưa duyệt) dựa
 * vào việc các trang đó không có liên kết sang trang khác của Studio, còn API vẫn ép quyền thật.
 */
export async function requireArea(area: Area, locale: Locale): Promise<Viewer | null> {
  const [state, path] = await Promise.all([getViewerState(), currentPath()]);
  if (state.status === 'unavailable') return null;
  const viewer = state.status === 'signed-in' ? state.viewer : null;
  const profileHref = '/studio/ho-so';
  const profilePath = getPathname({ href: profileHref, locale });
  const onHouseholdProfile =
    path !== null && path.split(/[?#]/)[0]?.replace(/\/$/, '') === profilePath;

  requireUsername(viewer, locale, path);
  const decision = decideAccess(viewer, area, { onHouseholdProfile });
  switch (decision.kind) {
    case 'allow':
      return viewer;
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
 * Cổng cho trang dùng chung mọi vai trò (trang tài khoản, GH#37): khách → đăng nhập kèm đường dẫn
 * để quay lại; ai đã đăng nhập cũng vào được, kể cả hộ chưa duyệt hay tài khoản bị khóa (để vẫn đổi
 * được mật khẩu). Returns `null` when the API could not say who is signed in; the page renders
 * {@link SessionUnavailable} then, like the area layouts.
 */
export async function requireViewer(locale: Locale): Promise<Viewer | null> {
  const [state, path] = await Promise.all([getViewerState(), currentPath()]);
  if (state.status === 'unavailable') return null;
  const viewer = state.status === 'signed-in' ? state.viewer : null;
  requireUsername(viewer, locale, path);
  if (viewer) return viewer;
  return redirect({
    href: { pathname: '/dang-nhap', ...(path ? { query: { next: path } } : {}) },
    locale,
  });
}

/**
 * Trang dành cho khách (đăng nhập, đăng ký): người đã đăng nhập không cần thấy lại form, nên được
 * chuyển tới đích quay lại (`next`, đã lọc an toàn) hoặc khu làm việc theo vai trò. API sập thì
 * cứ hiện form, vì vẫn có thể là khách.
 */
export async function redirectIfSignedIn(locale: Locale, next: string | null): Promise<void> {
  const state = await getViewerState();
  if (state.status !== 'signed-in') return;
  const viewer = state.viewer;
  requireUsername(viewer, locale, next);
  if (next) redirectTo(next);
  redirect({ href: landingPath(viewer.role), locale });
}
