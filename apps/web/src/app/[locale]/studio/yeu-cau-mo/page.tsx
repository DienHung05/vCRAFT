import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StudioOpenRequests } from '@/features/studio/studio-open-requests';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/yeu-cau-mo'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.invitations');
  return { title: t('openTitle'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/yeu-cau-mo'>) {
  await resolveLocale(params);
  return <StudioOpenRequests />;
}
