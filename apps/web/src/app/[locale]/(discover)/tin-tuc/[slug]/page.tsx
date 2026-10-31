import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchNewsArticle } from '@/features/news/news-api';
import { NewsArticleView } from '@/features/news/news-article';
import { VillageArticle } from '@/features/news/village-news';
import { resolveLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/tin-tuc/[slug]'>): Promise<Metadata> {
  await resolveLocale(params);
  const { slug } = await params;
  const t = await getTranslations('indexPages.news');
  const result = await fetchNewsArticle(slug);
  return result.status === 'ok'
    ? { title: result.article.title, description: result.article.summary }
    : { title: t('title'), robots: { index: false } };
}

/**
 * News article (FR-NEWS-01). Public items render on the server. A 404 may be a village-only item,
 * which only a signed-in approved household or administrator can read, so the browser tries that.
 */
export default async function NewsArticlePage({ params }: PageProps<'/[locale]/tin-tuc/[slug]'>) {
  await resolveLocale(params);
  const { slug } = await params;
  const t = await getTranslations('indexPages.news');
  const result = await fetchNewsArticle(slug);
  if (result.status === 'ok') return <NewsArticleView article={result.article} />;
  if (result.status === 'unavailable')
    return (
      <p role="status" className="mx-auto max-w-prose-vn px-gutter py-12 text-ash">
        {t('unavailable')}
      </p>
    );
  return <VillageArticle slug={slug} />;
}
