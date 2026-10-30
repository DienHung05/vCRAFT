import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchNews } from '@/features/news/news-api';
import { NewsView } from '@/features/news/news-view';
import { resolveLocale } from '@/lib/locale';

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
  const result = await fetchNews({ householdSlug, cursor: first(query.cursor) });
  return <NewsView result={result} householdSlug={householdSlug} />;
}
