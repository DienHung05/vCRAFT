/** Ngôn ngữ hỗ trợ (NFR-I18N). `vi` là mặc định. */
export const locales = ['vi', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'vi';

/**
 * Pathnames bản địa hóa (SRS §5.1). Khóa là đường dẫn nội bộ, trùng cây thư mục
 * `apps/web/src/app/[locale]`; giá trị là URL hiển thị theo từng ngôn ngữ.
 */
export const pathnames = {
  '/': '/',
  '/san-pham': { vi: '/san-pham', en: '/products' },
  '/san-pham/[slug]': { vi: '/san-pham/[slug]', en: '/products/[slug]' },
  '/nghe-nhan': { vi: '/nghe-nhan', en: '/artisans' },
  '/nghe-nhan/[slug]': { vi: '/nghe-nhan/[slug]', en: '/artisans/[slug]' },
  '/yeu-thich': { vi: '/yeu-thich', en: '/favourites' },
  '/ban-do': { vi: '/ban-do', en: '/map' },
  '/tin-tuc': { vi: '/tin-tuc', en: '/news' },
  '/tin-tuc/[slug]': { vi: '/tin-tuc/[slug]', en: '/news/[slug]' },
  '/truy-xuat/[code]': { vi: '/truy-xuat/[code]', en: '/trace/[code]' },
  '/ghi-nhan-anh': { vi: '/ghi-nhan-anh', en: '/image-credits' },
  '/chinh-sach-quyen-rieng-tu': { vi: '/chinh-sach-quyen-rieng-tu', en: '/privacy-policy' },
  '/yeu-cau-bao-gia': { vi: '/yeu-cau-bao-gia', en: '/quotes' },
  '/yeu-cau-bao-gia/moi': { vi: '/yeu-cau-bao-gia/moi', en: '/quotes/new' },
  '/yeu-cau-bao-gia/[code]': { vi: '/yeu-cau-bao-gia/[code]', en: '/quotes/[code]' },
  '/thanh-toan/[ref]': { vi: '/thanh-toan/[ref]', en: '/payment/[ref]' },
  // Tài khoản và phiên (FR-AUTH, SRS §5.1)
  '/dang-nhap': { vi: '/dang-nhap', en: '/login' },
  '/dang-ky': { vi: '/dang-ky', en: '/register' },
  '/chon-ten-dang-nhap': { vi: '/chon-ten-dang-nhap', en: '/choose-username' },
  '/dang-ky-nghe-nhan': { vi: '/dang-ky-nghe-nhan', en: '/register-household' },
  '/quen-mat-khau': { vi: '/quen-mat-khau', en: '/forgot-password' },
  '/dat-lai-mat-khau': { vi: '/dat-lai-mat-khau', en: '/reset-password' },
  '/chap-nhan-loi-moi': { vi: '/chap-nhan-loi-moi', en: '/accept-invitation' },
  '/tai-khoan': { vi: '/tai-khoan', en: '/account' },
  '/tai-khoan/phien-dang-nhap': { vi: '/tai-khoan/phien-dang-nhap', en: '/account/sessions' },
  '/studio/bao-gia': { vi: '/studio/bao-gia', en: '/studio/quotes' },
  '/studio/don-hang': { vi: '/studio/don-hang', en: '/studio/orders' },
  '/studio/ho-so': { vi: '/studio/ho-so', en: '/studio/profile' },
  '/studio/de-xuat-tham-gia/[id]': {
    vi: '/studio/de-xuat-tham-gia/[id]',
    en: '/studio/contributions/[id]',
  },
  '/admin': '/admin',
  '/admin/duyet-ho': { vi: '/admin/duyet-ho', en: '/admin/approvals' },
  '/admin/duyet-ho/[id]': { vi: '/admin/duyet-ho/[id]', en: '/admin/approvals/[id]' },
  '/studio': '/studio',
  '/studio/san-pham': { vi: '/studio/san-pham', en: '/studio/products' },
  '/studio/san-pham/moi': { vi: '/studio/san-pham/moi', en: '/studio/products/new' },
  '/studio/san-pham/[id]': { vi: '/studio/san-pham/[id]', en: '/studio/products/[id]' },
  '/studio/san-pham/[id]/nhat-ky': {
    vi: '/studio/san-pham/[id]/nhat-ky',
    en: '/studio/products/[id]/journal',
  },
  '/admin/tin-tuc': { vi: '/admin/tin-tuc', en: '/admin/news' },
  '/admin/tin-tuc/moi': { vi: '/admin/tin-tuc/moi', en: '/admin/news/new' },
  '/admin/tin-tuc/[id]': { vi: '/admin/tin-tuc/[id]', en: '/admin/news/[id]' },
  '/admin/nhat-ky': { vi: '/admin/nhat-ky', en: '/admin/audit-log' },
  '/admin/nguoi-dung': { vi: '/admin/nguoi-dung', en: '/admin/users' },
  '/admin/dieu-phoi': { vi: '/admin/dieu-phoi', en: '/admin/coordination' },
  '/admin/dieu-phoi/moi': { vi: '/admin/dieu-phoi/moi', en: '/admin/coordination/new' },
  '/admin/tien-do': { vi: '/admin/tien-do', en: '/admin/progress' },
  '/admin/thanh-toan': { vi: '/admin/thanh-toan', en: '/admin/payments' },
  '/admin/dieu-phoi/[code]': { vi: '/admin/dieu-phoi/[code]', en: '/admin/coordination/[code]' },
} as const;
