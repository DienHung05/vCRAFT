import {
  PRODUCT_CATEGORIES,
  PRODUCT_SORTS,
  type ProductCategory,
  type ProductSort,
} from '@vcraft/domain';
import { parsePageParam } from '@/lib/page-param';
import type { ProductFilters } from './exhibition-query';

/** Bộ lọc danh mục như trên URL (FR-CAT-02); giữ chuỗi để ô nhập số không nhảy khi đang gõ. */
export interface CatalogFilters {
  q: string;
  category: ProductCategory | '';
  household: string;
  minPrice: string;
  maxPrice: string;
  oneOfAKind: boolean;
  inStock: boolean;
  /** Only products of households with a workshop open to visitors (FR-CAT-02). */
  openWorkshop: boolean;
  sort: ProductSort;
  /** Current page (1-based). Omitted from URL when 1. */
  page: number;
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  category: '',
  household: '',
  minPrice: '',
  maxPrice: '',
  oneOfAKind: false,
  inStock: false,
  openWorkshop: false,
  sort: 'newest',
  page: 1,
};

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

const digits = (value: string) => (/^\d{1,10}$/.test(value) ? value : '');

/** Đọc URL; giá trị lạ bị bỏ qua thay vì làm trang lỗi. */
export function parseCatalogParams(
  params: Record<string, string | string[] | undefined>,
): CatalogFilters {
  const category = first(params.category);
  const sort = first(params.sort);
  const page = parsePageParam(params.page);
  return {
    q: first(params.q).slice(0, 120),
    category: PRODUCT_CATEGORIES.includes(category as ProductCategory)
      ? (category as ProductCategory)
      : '',
    household: first(params.household).slice(0, 160),
    minPrice: digits(first(params.minPrice)),
    maxPrice: digits(first(params.maxPrice)),
    oneOfAKind: first(params.oneOfAKind) === '1',
    inStock: first(params.inStock) === '1',
    openWorkshop: first(params.openWorkshop) === '1',
    sort: PRODUCT_SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : 'newest',
    page,
  };
}

/** Ghi lại lên URL; giá trị mặc định không xuất hiện để link gọn. */
export function catalogSearchParams(filters: CatalogFilters): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.q.trim()) query.set('q', filters.q.trim());
  if (filters.category) query.set('category', filters.category);
  if (filters.household) query.set('household', filters.household);
  if (filters.minPrice) query.set('minPrice', filters.minPrice);
  if (filters.maxPrice) query.set('maxPrice', filters.maxPrice);
  if (filters.oneOfAKind) query.set('oneOfAKind', '1');
  if (filters.inStock) query.set('inStock', '1');
  if (filters.openWorkshop) query.set('openWorkshop', '1');
  if (filters.sort !== 'newest') query.set('sort', filters.sort);
  if (filters.page > 1) query.set('page', String(filters.page));
  return query;
}

/** Đổi sang tham số của `GET /products`. */
export function toProductFilters(filters: CatalogFilters): ProductFilters {
  return {
    sort: filters.sort,
    page: filters.page,
    ...(filters.q.trim() && { q: filters.q.trim() }),
    ...(filters.category && { category: filters.category }),
    ...(filters.household && { household: filters.household }),
    ...(filters.minPrice && { minPrice: Number(filters.minPrice) }),
    ...(filters.maxPrice && { maxPrice: Number(filters.maxPrice) }),
    ...(filters.oneOfAKind && { oneOfAKind: true }),
    ...(filters.inStock && { inStock: true }),
    ...(filters.openWorkshop && { openWorkshop: true }),
  };
}
