import {
  type MaterialPriceSeriesDto,
  MaterialPriceSeriesResponseSchema,
  type NewsCategoryDto,
  type NewsDetailDto,
  NewsDetailResponseSchema,
  type NewsListDto,
  NewsListResponseSchema,
  type NewsPageDto,
  NewsPageResponseSchema,
} from '@vcraft/contracts';
import { fetchPublicJson } from '@/lib/api/fetch-public-json';
import { apiBaseUrl } from '@/lib/api/internal-url';

export { apiBaseUrl };

export type NewsResult =
  | { status: 'ok'; page: NewsListDto | NewsPageDto }
  | { status: 'unavailable' };

export interface FetchNewsOptions {
  category?: NewsCategoryDto | undefined;
  householdSlug?: string | undefined;
  cursor?: string | undefined;
  /** Numbered page (GH#202); the answer then carries page totals. Not combined with `cursor`. */
  page?: number | undefined;
  limit?: number | undefined;
}

/**
 * Lấy một trang tin công khai từ `GET /news`. API tắt, chậm hoặc trả sai dạng thì trả
 * `unavailable` để trang hiện thông báo thay vì lỗi 500.
 */
export async function fetchNews(options: FetchNewsOptions = {}): Promise<NewsResult> {
  const query = new URLSearchParams({ limit: String(options.limit ?? 24) });
  if (options.category) query.set('category', options.category);
  if (options.householdSlug) query.set('householdSlug', options.householdSlug);
  if (options.page) query.set('page', String(options.page));
  else if (options.cursor) query.set('cursor', options.cursor);
  const schema = options.page ? NewsPageResponseSchema : NewsListResponseSchema;
  const result = await fetchPublicJson(`/news?${query}`, schema, {
    revalidate: 30,
    logPath: '/news',
  });
  return result.status === 'ok' ? { status: 'ok', page: result.data } : { status: 'unavailable' };
}

export type NewsArticleResult =
  | { status: 'ok'; article: NewsDetailDto }
  | { status: 'not-found' }
  | { status: 'unavailable' };

/**
 * One public item from `GET /news/{slug}`. A 404 may still be a village-only item.
 * Read with `no-store`: a Data Cache entry would outlive the item's retirement, because Next keeps
 * the old 200 when the API starts answering 404 (GH#395).
 */
export async function fetchNewsArticle(slug: string): Promise<NewsArticleResult> {
  const result = await fetchPublicJson(
    `/news/${encodeURIComponent(slug)}`,
    NewsDetailResponseSchema,
    { logPath: '/news' },
  );
  return result.status === 'ok' ? { status: 'ok', article: result.data } : result;
}

/** Six months of material prices for the news page chart (PLAN E11); `null` when the API is down. */
export async function fetchMaterialPrices(): Promise<MaterialPriceSeriesDto | null> {
  const result = await fetchPublicJson('/news/material-prices', MaterialPriceSeriesResponseSchema, {
    revalidate: 300,
  });
  return result.status === 'ok' ? result.data : null;
}
