import type { NewsDetailDto, NewsSummaryDto, PublicImageDto } from '@vcraft/contracts';
import type { News } from '@vcraft/database';

/** Chỉ gọi với tin đã xuất bản (`publishedAt` luôn có) và đã nạp `household`. */
export function toNewsSummaryDto(news: News, cover: PublicImageDto | null): NewsSummaryDto {
  return {
    slug: news.slug,
    title: news.title,
    summary: news.summary,
    category: news.category,
    pinned: news.pinned,
    publishedAt: (news.publishedAt as Date).toISOString(),
    householdName: news.household?.name ?? null,
    householdSlug: news.household?.slug ?? null,
    cover,
  };
}

export function toNewsDetailDto(news: News, cover: PublicImageDto | null): NewsDetailDto {
  return { ...toNewsSummaryDto(news, cover), body: news.body };
}
