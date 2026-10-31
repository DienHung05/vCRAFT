import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductEditor } from '@/features/studio/product-editor';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/san-pham/[id]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.products');
  return { title: t('editTitle'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/san-pham/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  return <ProductEditor productId={id} />;
}
