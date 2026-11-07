import {
  type MaterialPriceSeriesDto,
  MaterialPriceSeriesResponseSchema,
  type NewsDetailDto,
  NewsDetailResponseSchema,
  type NewsListDto,
  NewsListResponseSchema,
} from '@vcraft/contracts';

import { apiBaseUrl } from '@/lib/api/internal-url';
import { logApiFailure } from '@/lib/api/log-api-failure';

export { apiBaseUrl };

export type NewsResult = { status: 'ok'; page: NewsListDto } | { status: 'unavailable' };

export interface FetchNewsOptions {
  householdSlug?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}

const TIMEOUT_MS = 4000;

/**
 * Lấy một trang tin công khai từ `GET /news`. API tắt, chậm hoặc trả sai dạng thì trả
 * `unavailable` để trang hiện thông báo thay vì lỗi 500.
 */
export async function fetchNews(options: FetchNewsOptions = {}): Promise<NewsResult> {
  const query = new URLSearchParams({ limit: String(options.limit ?? 24) });
  if (options.householdSlug) query.set('householdSlug', options.householdSlug);
  if (options.cursor) query.set('cursor', options.cursor);
  try {
    const res = await fetch(`${apiBaseUrl()}/news?${query}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logApiFailure('/news', { kind: 'http', status: res.status });
      return { status: 'unavailable' };
    }
    const parsed = NewsListResponseSchema.safeParse(await res.json());
    if (parsed.success) return { status: 'ok', page: parsed.data };
    logApiFailure('/news', { kind: 'schema', issues: parsed.error.issues });
    return { status: 'unavailable' };
  } catch (error) {
    logApiFailure('/news', { kind: 'error', error });
    return { status: 'unavailable' };
  }
}

export type NewsArticleResult =
  | { status: 'ok'; article: NewsDetailDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/** One public item from `GET /news/{slug}`. A 404 may still be a village-only item. */
export async function fetchNewsArticle(slug: string): Promise<NewsArticleResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/news/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) {
      logApiFailure('/news', { kind: 'http', status: res.status });
      return { status: 'unavailable' };
    }
    const parsed = NewsDetailResponseSchema.safeParse(await res.json());
    if (parsed.success) return { status: 'ok', article: parsed.data };
    logApiFailure('/news', { kind: 'schema', issues: parsed.error.issues });
    return { status: 'unavailable' };
  } catch (error) {
    logApiFailure('/news', { kind: 'error', error });
    return { status: 'unavailable' };
  }
}

/** Six months of material prices for the news page chart (PLAN E11); `null` when the API is down. */
export async function fetchMaterialPrices(): Promise<MaterialPriceSeriesDto | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/news/material-prices`, {
      headers: { accept: 'application/json' },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      logApiFailure('/news/material-prices', { kind: 'http', status: res.status });
      return null;
    }
    const parsed = MaterialPriceSeriesResponseSchema.safeParse(await res.json());
    if (parsed.success) return parsed.data;
    logApiFailure('/news/material-prices', { kind: 'schema', issues: parsed.error.issues });
    return null;
  } catch (error) {
    logApiFailure('/news/material-prices', { kind: 'error', error });
    return null;
  }
}
