import en from '../messages/en.json';
import vi from '../messages/vi.json';

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
  '/ban-do': { vi: '/ban-do', en: '/map' },
  '/tin-tuc': { vi: '/tin-tuc', en: '/news' },
  '/truy-xuat/[code]': { vi: '/truy-xuat/[code]', en: '/trace/[code]' },
  '/yeu-cau-bao-gia': { vi: '/yeu-cau-bao-gia', en: '/quotes' },
  '/yeu-cau-bao-gia/[code]': { vi: '/yeu-cau-bao-gia/[code]', en: '/quotes/[code]' },
  '/admin/dieu-phoi': { vi: '/admin/dieu-phoi', en: '/admin/coordination' },
  '/admin/dieu-phoi/[code]': { vi: '/admin/dieu-phoi/[code]', en: '/admin/coordination/[code]' },
} as const;

export type Messages = typeof vi;

/** Từ điển theo ngôn ngữ. Bản `en` phải cùng cấu trúc khóa với `vi` (kiểm ở test). */
export const messages: Record<Locale, Messages> = { vi, en };
