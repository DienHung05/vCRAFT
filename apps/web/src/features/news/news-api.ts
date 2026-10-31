import { type NewsListDto, NewsListResponseSchema } from '@vcraft/contracts';

import { apiBaseUrl } from '@/lib/api/internal-url';

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
    if (!res.ok) return { status: 'unavailable' };
    const parsed = NewsListResponseSchema.safeParse(await res.json());
    return parsed.success ? { status: 'ok', page: parsed.data } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}
