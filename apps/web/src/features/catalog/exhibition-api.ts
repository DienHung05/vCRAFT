import {
  HouseholdListResponseSchema,
  ProductDetailResponseSchema,
  ProductListResponseSchema,
  PublicHouseholdResponseSchema,
  SlugRedirectResponseSchema,
  TraceAvailabilityResponseSchema,
  VillageStatsSchema,
} from '@vcraft/contracts';
import { apiBaseUrl } from '@/features/news/news-api';
import { type ProductFilters, productsQueryString } from './exhibition-query';

/** `not-found` là 404 thật của API; `unavailable` là API tắt, chậm hoặc trả sai dạng (hiện thử lại). */
export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'unavailable' };

async function getJson<T>(
  path: string,
  schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false } },
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'unavailable' };
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? { status: 'ok', data: parsed.data } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export const fetchProducts = (filters: ProductFilters = {}) =>
  getJson(`/products?${productsQueryString(filters)}`, ProductListResponseSchema);

export const fetchProduct = (slug: string) =>
  getJson(`/products/${encodeURIComponent(slug)}`, ProductDetailResponseSchema);

export const fetchHouseholds = () => getJson('/households', HouseholdListResponseSchema);

export const fetchHousehold = (slug: string) =>
  getJson(`/households/${encodeURIComponent(slug)}`, PublicHouseholdResponseSchema);

/** The current slug behind a retired product or household slug (PLAN E5); `not-found` if none. */
export const fetchSlugRedirect = (kind: 'products' | 'households', slug: string) =>
  getJson(`/redirects/${kind}/${encodeURIComponent(slug)}`, SlugRedirectResponseSchema);

export const fetchTrace = (code: string) =>
  getJson(`/trace/${encodeURIComponent(code)}`, TraceAvailabilityResponseSchema);

export const fetchVillageStats = () => getJson('/village/stats', VillageStatsSchema);
