/** Danh mục sản phẩm gốm của làng (FR-CAT-01); tên hiển thị nằm trong `@vcraft/i18n`. */
export const PRODUCT_CATEGORIES = ['VASE', 'TABLEWARE', 'TEA', 'DECOR', 'WORSHIP'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Catalog sort orders (FR-CAT-02). Plain data kept here, not in `@vcraft/contracts`, so client code can
 * read the list without pulling in the zod schemas. `popular` ranks by trace QR scans in the last 30 days,
 * then newest.
 */
export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'popular'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Category names in both site languages, for matching a search phrase to a category (FR-CAT-04). The
 * displayed names live in `@vcraft/i18n` (`catalog.categories`); a web test keeps the two in step.
 */
export const PRODUCT_CATEGORY_LABELS: Readonly<
  Record<ProductCategory, { readonly vi: string; readonly en: string }>
> = {
  VASE: { vi: 'Bình, lọ', en: 'Vases and jars' },
  TABLEWARE: { vi: 'Bát đĩa', en: 'Tableware' },
  TEA: { vi: 'Ấm chén, đồ trà', en: 'Tea sets' },
  DECOR: { vi: 'Trang trí', en: 'Decor' },
  WORSHIP: { vi: 'Đồ thờ', en: 'Altar pieces' },
};
