import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewProductForm } from '@/features/studio/new-product-form';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/san-pham/moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.products');
  return { title: t('newTitle'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/san-pham/moi'>) {
  await resolveLocale(params);
  return <NewProductForm />;
}
