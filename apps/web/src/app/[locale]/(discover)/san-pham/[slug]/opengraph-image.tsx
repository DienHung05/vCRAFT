import { getTranslations } from 'next-intl/server';
import { fetchProduct } from '@/features/catalog/exhibition-api';
import { resolveLocale } from '@/lib/locale';
import { textFor } from '@/lib/localized-text';
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from '@/lib/seo/og-card';

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateImageMetadata({ params }: Params) {
  const { slug } = await params;
  const result = await fetchProduct(slug);
  return [
    {
      id: 'card',
      size,
      contentType,
      alt: result.status === 'ok' ? result.data.product.name : 'vCraft',
    },
  ];
}

/** Share card for a product page: name and household (PLAN S6). */
export default async function Image({ params }: Params) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const [t, result] = await Promise.all([
    getTranslations({ locale, namespace: 'nav' }),
    fetchProduct(slug),
  ]);
  return renderOgCard(
    result.status === 'ok'
      ? {
          eyebrow: t('products'),
          title: textFor(locale, result.data.product.name, result.data.product.nameEn),
          subtitle: result.data.household.name,
        }
      : { eyebrow: t('products'), title: 'vCraft' },
  );
}
