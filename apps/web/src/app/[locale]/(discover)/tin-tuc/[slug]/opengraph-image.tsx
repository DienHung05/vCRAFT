import { getTranslations } from 'next-intl/server';
import { fetchNewsArticle } from '@/features/news/news-api';
import { resolveLocale } from '@/lib/locale';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/seo/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateImageMetadata({ params }: Params) {
  const { slug } = await params;
  const result = await fetchNewsArticle(slug);
  return [
    {
      id: 'card',
      size,
      contentType,
      alt: result.status === 'ok' ? result.article.title : 'vCraft',
    },
  ];
}

/** Share card for a news item: title and summary (PLAN S6). */
export default async function Image({ params }: Params) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const [t, meta, result] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    getTranslations({ locale, namespace: 'meta' }),
    fetchNewsArticle(slug),
  ]);
  return renderOgCard(
    result.status === 'ok'
      ? {
          eyebrow: t('news'),
          title: result.article.title,
          subtitle: result.article.summary,
          slogan: meta('slogan'),
        }
      : { eyebrow: t('news'), title: 'vCraft', slogan: meta('slogan') },
  );
}
