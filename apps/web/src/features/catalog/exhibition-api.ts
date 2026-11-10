import {
  HouseholdListResponseSchema,
  HouseholdPageResponseSchema,
  ProductDetailResponseSchema,
  ProductListResponseSchema,
  ProductPageResponseSchema,
  PublicHouseholdResponseSchema,
  SlugRedirectResponseSchema,
  TraceAvailabilityResponseSchema,
  VillageStatsSchema,
} from '@vcraft/contracts';
import { cache } from 'react';
import { fetchPublicJson, type JsonSchemaLike } from '@/lib/api/fetch-public-json';
import { type ProductFilters, productsQueryString } from './exhibition-query';

/** `not-found` là 404 thật của API; `unavailable` là API tắt, chậm hoặc trả sai dạng (hiện thử lại). */
export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'unavailable' };

function getJson<T>(
  path: string,
  schema: JsonSchemaLike<T>,
  /** Slow-changing helpers (redirects, village stats) opt back into ISR; everything else is
   * `no-store` so a suspension or withdrawal is visible on the very next request (vCRAFT-8my.1). */
  next: { revalidate: number } | undefined = undefined,
): Promise<ApiResult<T>> {
  return fetchPublicJson(path, schema, next ? { revalidate: next.revalidate } : {});
}

export const fetchProducts = (filters: ProductFilters = {}) =>
  getJson(`/products?${productsQueryString(filters)}`, ProductListResponseSchema);

/** One numbered page of the catalog (`?page=N`), with the totals the page bar needs (ADR-0020). */
export const fetchProductPage = (filters: ProductFilters & { page: number }) =>
  getJson(`/products?${productsQueryString(filters)}`, ProductPageResponseSchema);

export const fetchProduct = (slug: string) =>
  getJson(`/products/${encodeURIComponent(slug)}`, ProductDetailResponseSchema);

export const fetchHouseholds = () => getJson('/households', HouseholdListResponseSchema);

/** One numbered page of the household list with its totals (GH#202). */
export const fetchHouseholdPage = (page: number, limit: number) =>
  getJson(`/households?page=${page}&limit=${limit}`, HouseholdPageResponseSchema);

/** Share metadata/page reads within one server render. React resets this memo on each request;
 * the underlying fetch remains no-store so a suspension is visible on the next request. */
export const fetchHousehold = cache((slug: string) =>
  getJson(`/households/${encodeURIComponent(slug)}`, PublicHouseholdResponseSchema),
);

/** The current slug behind a retired product or household slug (PLAN E5); `not-found` if none. */
export const fetchSlugRedirect = (kind: 'products' | 'households', slug: string) =>
  getJson(`/redirects/${kind}/${encodeURIComponent(slug)}`, SlugRedirectResponseSchema, {
    revalidate: 30,
  });

export const fetchTrace = (code: string) =>
  getJson(`/trace/${encodeURIComponent(code)}`, TraceAvailabilityResponseSchema);

export const fetchVillageStats = () =>
  getJson('/village/stats', VillageStatsSchema, { revalidate: 30 });
