import type { MeDto } from '@vcraft/contracts';
import type { AccountRole } from '@vcraft/domain';

/**
 * Luật vào khu vực theo vai trò (FR-AUTH-09). Hàm thuần, không đụng request, để test được và để
 * layout, trang hay proxy dùng chung một quyết định. Quyền thật vẫn do API ép ở mọi route; đây chỉ
 * là lớp giao diện không cho người sai vai trò thấy khung trang.
 */
export type Area = 'buyer' | 'studio' | 'admin';

/** Vai trò duy nhất được vào mỗi khu vực (GLOSSARY: Buyer, Household representative, Village administrator). */
export const AREA_ROLE: Record<Area, AccountRole> = {
  buyer: 'BUYER',
  studio: 'HOUSEHOLD',
  admin: 'ADMIN',
};

export type AccessDecision =
  | { readonly kind: 'allow' }
  /** Khách: chuyển tới đăng nhập kèm đường dẫn để quay lại. */
  | { readonly kind: 'sign-in' }
  /** Sai vai trò hoặc tài khoản bị khóa: trang kiểu 403. */
  | { readonly kind: 'forbidden'; readonly reason: 'role' | 'locked' }
  /** Hộ chưa được chấp nhận chỉ xem trạng thái hồ sơ: chuyển tới trang đó. */
  | { readonly kind: 'household-profile' };

/** Hộ ở trạng thái này chưa có khu làm việc (chờ duyệt) hoặc không có (bị từ chối). */
const PROFILE_ONLY_STATUSES: ReadonlySet<string> = new Set(['DRAFT', 'PENDING_REVIEW', 'REJECTED']);

export interface AccessContext {
  /** Đang ở trang trạng thái hồ sơ hộ, nơi hộ chưa duyệt vẫn được xem. */
  readonly onHouseholdProfile?: boolean;
}

export function decideAccess(
  viewer: Pick<MeDto, 'role' | 'status' | 'household'> | null,
  area: Area,
  context: AccessContext = {},
): AccessDecision {
  if (!viewer) return { kind: 'sign-in' };
  if (viewer.status === 'LOCKED') return { kind: 'forbidden', reason: 'locked' };
  if (viewer.role !== AREA_ROLE[area]) return { kind: 'forbidden', reason: 'role' };
  if (area === 'studio' && !context.onHouseholdProfile) {
    const status = viewer.household?.status;
    if (status === undefined || PROFILE_ONLY_STATUSES.has(status)) {
      return { kind: 'household-profile' };
    }
  }
  return { kind: 'allow' };
}

/** Trang "việc của tôi" theo vai trò, dùng cho menu tài khoản. */
export function workspacePath(role: AccountRole) {
  switch (role) {
    case 'ADMIN':
      return '/admin' as const;
    case 'HOUSEHOLD':
      return '/studio/ho-so' as const;
    case 'BUYER':
      return '/yeu-cau-bao-gia' as const;
  }
}

/** Nơi tới sau khi đăng nhập mà không có đích quay lại: khách về trang chủ, vai trò khác vào khu làm việc. */
export function landingPath(role: AccountRole) {
  return role === 'BUYER' ? ('/' as const) : workspacePath(role);
}

/**
 * Landing after sign-in for a known viewer. GH#180: a Buyer who started household registration and has
 * not submitted the household info yet goes back to the wizard instead of the home page.
 */
export function landingPathFor(
  viewer: Pick<MeDto, 'role' | 'household'>,
  unfinishedHouseholdRegistration: boolean,
) {
  if (unfinishedHouseholdRegistration && viewer.role === 'BUYER' && !viewer.household) {
    return '/dang-ky-nghe-nhan' as const;
  }
  return landingPath(viewer.role);
}
