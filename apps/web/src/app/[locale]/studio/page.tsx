import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudioHome } from '@/features/studio/studio-home';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.nav');
  return { title: `Studio · ${t('home')}`, robots: { index: false } };
}

export default async function StudioHomePage({ params }: PageProps<'/[locale]/studio'>) {
  await resolveLocale(params);
  return <StudioHome />;
}
