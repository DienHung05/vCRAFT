import { NewsCategorySchema } from '@vcraft/contracts';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { MaterialPriceChart } from '@/features/news/material-price-chart';
import { fetchMaterialPrices, fetchNews } from '@/features/news/news-api';
import { NewsView } from '@/features/news/news-view';
import { VillageNews } from '@/features/news/village-news';
import { resolveLocale } from '@/lib/locale';
import { parsePageParam } from '@/lib/page-param';

/** News items per numbered page (GH#202). */
const NEWS_PAGE_SIZE = 12;

// Tin lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/tin-tuc'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.news');
  return { title: t('title'), description: t('lead') };
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) || undefined;

/** Tin tức làng nghề (vCRAFT-83g): tin chung và tin của từng hộ, lấy từ API công khai `GET /news`. */
export default async function NewsIndexPage({
  params,
  searchParams,
}: PageProps<'/[locale]/tin-tuc'>) {
  await resolveLocale(params);
  const query = await searchParams;
  const householdSlug = first(query.household);
  const parsedCategory = NewsCategorySchema.safeParse(first(query.category));
  const category = parsedCategory.success ? parsedCategory.data : undefined;
  const [result, prices] = await Promise.all([
    fetchNews({ category, householdSlug, page: parsePageParam(query.page), limit: NEWS_PAGE_SIZE }),
    // The village-wide price chart belongs on the main list, not on a household's own news.
    householdSlug ? null : fetchMaterialPrices(),
  ]);
  return (
    <NewsView result={result} householdSlug={householdSlug} category={category}>
      <VillageNews />
      {prices && prices.series.length > 0 ? (
        <div className="mt-8">
          <MaterialPriceChart series={prices.series} />
        </div>
      ) : null}
    </NewsView>
  );
}
