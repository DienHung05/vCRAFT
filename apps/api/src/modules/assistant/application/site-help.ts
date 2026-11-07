import { foldVietnamese } from '@vcraft/utils';

const TOPICS = [
  [
    /\b(admin|administrator|moderation|duyet ho|dieu phoi|quan tri|ban quan ly|nhat ky he thong)\b/,
    'admin',
  ],
  [
    /\b(studio|household|ho san xuat|nghe nhan|production journal|nhat ky san xuat|dang ky ho)\b/,
    'household',
  ],
  [
    /\b(account|sign up|sign in|log in|password|privacy|profile|tai khoan|dang nhap|dang ky|mat khau|quyen rieng tu)\b/,
    'accounts',
  ],
  [
    /\b(quote|quotation|bid|order|payment|delivery|buyer|bao gia|dat hang|don hang|thanh toan|giao hang)\b/,
    'buyer',
  ],
  [/\b(qr|trace|truy xuat)\b/, 'trace'],
] as const;

const DESCRIPTIONS = {
  overview: {
    vi: 'Hướng dẫn sử dụng vCraft toàn bộ hệ thống, tổng quan và sơ đồ trang, khách vãng lai, khách mua, người đại diện hộ, quản trị viên làng',
    en: 'vCraft user guide, end-to-end overview and site map, guest, buyer, household representative, village administrator',
  },
  accounts: {
    vi: 'Hướng dẫn tài khoản, đăng ký, đăng nhập, quên mật khẩu, phiên đăng nhập, hồ sơ, quyền riêng tư',
    en: 'User guide accounts, sign up, sign in, password reset, sessions, profile, privacy',
  },
  buyer: {
    vi: 'Hướng dẫn khách mua, yêu cầu báo giá, báo giá, đơn hàng, thanh toán, giao hàng và trạng thái',
    en: 'Buyer user guide, quotation requests, quotations, orders, payment, delivery and statuses',
  },
  household: {
    vi: 'Hướng dẫn người đại diện hộ sản xuất, đăng ký hộ, Studio, sản phẩm, nhật ký sản xuất, ảnh, báo giá, phân bổ đơn hàng',
    en: 'Household representative user guide, registration, Studio, products, production journal, media, quotations, allocations',
  },
  admin: {
    vi: 'Hướng dẫn quản trị viên làng, duyệt hộ, điều phối báo giá hợp tác, tiến độ, tin tức, thông báo, nhật ký hệ thống',
    en: 'Village administrator user guide, household approval, cooperative quotation coordination, progress, news, notifications, audit log',
  },
  trace: {
    vi: 'Hướng dẫn truy xuất mã QR, nhật ký sản xuất, toàn vẹn nhật ký và thông tin công khai',
    en: 'QR traceability user guide, production journal, journal integrity and public information',
  },
  catalog: {
    vi: 'Hướng dẫn tìm kiếm sản phẩm, hộ sản xuất, nghệ nhân và bản đồ xưởng trong triển lãm số',
    en: 'User guide browsing and searching products, households, artisans and workshop map in the digital exhibition',
  },
} as const;

type Topic = keyof typeof DESCRIPTIONS;

function pageTopic(pagePath: string): Topic {
  const path = pagePath.replace(/^\/(vi|en)(?=\/|$)/, '');
  if (/^\/admin(?:\/|$)/.test(path)) return 'admin';
  if (/^\/studio(?:\/|$)|^\/(dang-ky-nghe-nhan|register-household)(?:\/|$)/.test(path))
    return 'household';
  if (
    /^\/(tai-khoan|account|dang-nhap|login|dang-ky|register|quen-mat-khau|forgot-password|dat-lai-mat-khau|reset-password)(?:\/|$)/.test(
      path,
    )
  )
    return 'accounts';
  if (/^\/(yeu-cau-bao-gia|quotes)(?:\/|$)/.test(path)) return 'buyer';
  if (/^\/(truy-xuat|trace)(?:\/|$)/.test(path)) return 'trace';
  if (/^\/(san-pham|products|nghe-nhan|artisans|ban-do|map)(?:\/|$)/.test(path)) return 'catalog';
  return 'overview';
}

/** Expand vague questions using known page categories, without sending private route IDs to search. */
export function siteHelpQuery(message: string, pagePath: string, locale: 'vi' | 'en'): string {
  const folded = foldVietnamese(message);
  const pageAware = /\b(this page|on this screen|do here|trang nay|man hinh nay|o day)\b/.test(
    folded,
  );
  const topic = pageAware
    ? pageTopic(pagePath)
    : (TOPICS.find(([pattern]) => pattern.test(folded))?.[1] ?? 'overview');
  return `${message}\n${DESCRIPTIONS[topic][locale]}`;
}
