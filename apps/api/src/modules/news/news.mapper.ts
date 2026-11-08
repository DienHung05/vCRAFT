import type {
  MaterialPriceDataDto,
  NewsDetailDto,
  NewsSummaryDto,
  PowerScheduleDataDto,
  PublicImageDto,
} from '@vcraft/contracts';
import type { News } from '@vcraft/database';

/** The structured payload of a news item, split by kind (PLAN E11). */
export function newsDataOf(news: News): {
  materialPrices: MaterialPriceDataDto | null;
  powerSchedule: PowerScheduleDataDto | null;
} {
  const data = news.data ?? null;
  return {
    materialPrices:
      data && 'materialPrices' in data ? (data.materialPrices as MaterialPriceDataDto) : null,
    powerSchedule:
      data && 'powerSchedule' in data ? (data.powerSchedule as PowerScheduleDataDto) : null,
  };
}

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
    sourceName: news.sourceName ?? null,
    sourceUrl: news.sourceUrl ?? null,
    sourcePublishedAt: news.sourcePublishedAt?.toISOString() ?? null,
  };
}

export function toNewsDetailDto(
  news: News,
  cover: PublicImageDto | null,
  related: NewsSummaryDto[],
): NewsDetailDto {
  return {
    ...toNewsSummaryDto(news, cover),
    body: news.body,
    bodyHtml: news.bodyHtml ?? null,
    visibility: news.visibility,
    ...newsDataOf(news),
    related,
  };
}
