import { getTranslations } from 'next-intl/server';
import { fetchHousehold } from '@/features/catalog/exhibition-api';
import { resolveLocale } from '@/lib/locale';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/seo/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateImageMetadata({ params }: Params) {
  const { slug } = await params;
  const result = await fetchHousehold(slug);
  return [
    { id: 'card', size, contentType, alt: result.status === 'ok' ? result.data.name : 'vCraft' },
  ];
}

/** Share card for a household page: name and the first line of its history (PLAN S6). */
export default async function Image({ params }: Params) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    fetchHousehold(slug),
  ]);
  return renderOgCard(
    result.status === 'ok'
      ? { eyebrow: t('artisans'), title: result.data.name, subtitle: result.data.history }
      : { eyebrow: t('artisans'), title: 'vCraft' },
  );
}
