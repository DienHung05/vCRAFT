import type { NotificationTargetDto } from '@vcraft/contracts';

/** Đích `Link`/`getPathname` của next-intl: đường dẫn nội bộ kèm tham số động. */
export type NotificationHref =
  | { pathname: '/yeu-cau-bao-gia/[code]'; params: { code: string } }
  | { pathname: '/studio/de-xuat-tham-gia/[id]'; params: { id: string } }
  | { pathname: '/admin/dieu-phoi/[code]'; params: { code: string } }
  | { pathname: '/studio/ho-so' };

/**
 * Trang một thông báo dẫn tới (GH#37), tách khỏi ngôn ngữ: slug vi/en do `pathnames` của next-intl
 * quyết định. Trang cần mã mà thông báo không có thì không có đích (`null`).
 */
export function notificationHref(target: NotificationTargetDto | null): NotificationHref | null {
  if (!target) return null;
  switch (target.page) {
    case 'BUYER_RFQ':
      return target.id
        ? { pathname: '/yeu-cau-bao-gia/[code]', params: { code: target.id } }
        : null;
    case 'STUDIO_CONTRIBUTION':
      return target.id
        ? { pathname: '/studio/de-xuat-tham-gia/[id]', params: { id: target.id } }
        : null;
    case 'ADMIN_COORDINATION':
      return target.id
        ? { pathname: '/admin/dieu-phoi/[code]', params: { code: target.id } }
        : null;
    case 'STUDIO_APPLICATION':
      return { pathname: '/studio/ho-so' };
  }
}
