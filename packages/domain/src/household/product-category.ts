/** Danh mục sản phẩm gốm của làng (FR-CAT-01); tên hiển thị nằm trong `@vcraft/i18n`. */
export const PRODUCT_CATEGORIES = ['VASE', 'TABLEWARE', 'TEA', 'DECOR', 'WORSHIP'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
