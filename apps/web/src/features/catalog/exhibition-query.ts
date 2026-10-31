import type { ListProductsQuery } from '@vcraft/contracts';

export type ProductFilters = Partial<Omit<ListProductsQuery, 'limit'>> & { limit?: number };

/** Chuỗi truy vấn của `GET /products`, dùng chung cho server và trình duyệt. */
export function productsQueryString(filters: ProductFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}
