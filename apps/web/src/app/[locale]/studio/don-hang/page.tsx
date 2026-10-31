import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudioAllocations } from '@/features/studio/studio-allocations';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/don-hang'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.allocations');
  return { title: t('title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/don-hang'>) {
  await resolveLocale(params);
  return <StudioAllocations />;
}
