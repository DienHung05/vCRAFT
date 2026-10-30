import type { NewsDetailDto, NewsSummaryDto } from '@vcraft/contracts';
import type { News } from '@vcraft/database';

/** Chỉ gọi với tin đã xuất bản (`publishedAt` luôn có) và đã nạp `household`. */
export function toNewsSummaryDto(news: News): NewsSummaryDto {
  return {
    slug: news.slug,
    title: news.title,
    summary: news.summary,
    category: news.category,
    pinned: news.pinned,
    publishedAt: (news.publishedAt as Date).toISOString(),
    householdName: news.household?.name ?? null,
    householdSlug: news.household?.slug ?? null,
  };
}

export function toNewsDetailDto(news: News): NewsDetailDto {
  return { ...toNewsSummaryDto(news), body: news.body };
}
