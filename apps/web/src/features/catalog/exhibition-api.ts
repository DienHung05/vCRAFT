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
import { EXHIBITION_TAG, householdTag, productTag, traceTag } from '@vcraft/utils';
import { cache } from 'react';
import { fetchPublicJson, type JsonSchemaLike } from '@/lib/api/fetch-public-json';
import { type ProductFilters, productsQueryString } from './exhibition-query';

/** `not-found` là 404 thật của API; `unavailable` là API tắt, chậm hoặc trả sai dạng (hiện thử lại). */
export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/**
 * Public exhibition reads go through the Next Data Cache (ADR-0027, supersedes the `no-store` rule of
 * vCRAFT-8my.1): `revalidate: 60` is the fallback TTL, and every read carries tags so a suspension, a
 * withdrawal or an edit is visible at once. The API (through the worker's outbox) calls
 * `POST /api/revalidate` when such a change commits; that route drops the matching tags.
 *
 * Nothing personalised or signed-in goes through here: these are anonymous reads of public data, with
 * no cookies or auth headers. The trace read includes `scanCount`, so a scan shows up on the page after
 * at most 60 s (the scan itself is recorded by `POST /trace/{code}/scan`, never by this GET).
 */
const REVALIDATE_SECONDS = 60;

function getJson<T>(
  path: string,
  schema: JsonSchemaLike<T>,
  /** `tags` always start with the broad `exhibition` tag; `revalidate` defaults to the 60 s fallback. */
  next: { tags: readonly (string | null)[]; revalidate?: number },
): Promise<ApiResult<T>> {
  return fetchPublicJson(path, schema, {
    revalidate: next.revalidate ?? REVALIDATE_SECONDS,
    tags: [EXHIBITION_TAG, ...next.tags.filter((tag): tag is string => tag !== null)],
  });
}

const LISTS = { tags: [] } as const;

export const fetchProducts = (filters: ProductFilters = {}) =>
  getJson(`/products?${productsQueryString(filters)}`, ProductListResponseSchema, LISTS);

/** One numbered page of the catalog (`?page=N`), with the totals the page bar needs (ADR-0020). */
export const fetchProductPage = (filters: ProductFilters & { page: number }) =>
  getJson(`/products?${productsQueryString(filters)}`, ProductPageResponseSchema, LISTS);

export const fetchProduct = (slug: string) =>
  getJson(`/products/${encodeURIComponent(slug)}`, ProductDetailResponseSchema, {
    tags: [productTag(slug)],
  });

export const fetchHouseholds = () => getJson('/households', HouseholdListResponseSchema, LISTS);

/** One numbered page of the household list with its totals (GH#202). */
export const fetchHouseholdPage = (page: number, limit: number) =>
  getJson(`/households?page=${page}&limit=${limit}`, HouseholdPageResponseSchema, LISTS);

/** Share metadata/page reads within one server render. React resets this memo on each request; the
 * underlying fetch is a tagged Data Cache read, dropped on demand when the household changes. */
export const fetchHousehold = cache((slug: string) =>
  getJson(`/households/${encodeURIComponent(slug)}`, PublicHouseholdResponseSchema, {
    tags: [householdTag(slug)],
  }),
);

/** The current slug behind a retired product or household slug (PLAN E5); `not-found` if none. */
export const fetchSlugRedirect = (kind: 'products' | 'households', slug: string) =>
  getJson(`/redirects/${kind}/${encodeURIComponent(slug)}`, SlugRedirectResponseSchema, {
    tags: [],
    revalidate: 30,
  });

export const fetchTrace = (code: string) =>
  getJson(`/trace/${encodeURIComponent(code)}`, TraceAvailabilityResponseSchema, {
    tags: [traceTag(code)],
  });

export const fetchVillageStats = () =>
  getJson('/village/stats', VillageStatsSchema, { tags: [], revalidate: 30 });
