import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductList } from '@/features/studio/product-list';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/san-pham'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.products');
  return { title: t('title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/san-pham'>) {
  await resolveLocale(params);
  return <ProductList />;
}
