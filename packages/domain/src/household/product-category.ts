/** Danh mục sản phẩm gốm của làng (FR-CAT-01); tên hiển thị nằm trong `@vcraft/i18n`. */
export const PRODUCT_CATEGORIES = ['VASE', 'TABLEWARE', 'TEA', 'DECOR', 'WORSHIP'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Catalog sort orders (FR-CAT-02). Plain data kept here, not in `@vcraft/contracts`, so client code can
 * read the list without pulling in the zod schemas.
 */
export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
