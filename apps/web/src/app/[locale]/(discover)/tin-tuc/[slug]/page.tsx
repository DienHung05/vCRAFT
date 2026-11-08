import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DataUnavailable } from '@/components/data-unavailable';
import { fetchNewsArticle } from '@/features/news/news-api';
import { NewsArticleView } from '@/features/news/news-article';
import { VillageArticle } from '@/features/news/village-news';
import { hasServerSession } from '@/lib/auth/viewer';
import { resolveLocale } from '@/lib/locale';
import { metaDescription, pageMetadata } from '@/lib/seo/page-metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/tin-tuc/[slug]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const t = await getTranslations('indexPages.news');
  const result = await fetchNewsArticle(slug);
  return result.status === 'ok'
    ? pageMetadata({
        locale,
        href: { pathname: '/tin-tuc/[slug]', params: { slug: result.article.slug } },
        title: result.article.title,
        description: metaDescription(result.article.summary),
        type: 'article',
      })
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
      <div className="mx-auto max-w-prose-vn px-gutter py-12">
        <h1 className="text-h1">{t('title')}</h1>
        <DataUnavailable className="mt-4" message={t('unavailable')} />
      </div>
    );
  // A guest can never read a village-only item, so an unknown slug is a real 404 for them (GH#256);
  // a signed-in visitor may be a village household, whose browser tries the members-only route.
  if (!(await hasServerSession())) notFound();
  return <VillageArticle slug={slug} />;
}
