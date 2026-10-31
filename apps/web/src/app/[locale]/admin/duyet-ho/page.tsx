import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HouseholdQueue } from '@/features/admin/household-queue';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/duyet-ho'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.queue');
  return { title: t('title'), robots: { index: false } };
}

export default async function HouseholdQueuePage({
  params,
}: PageProps<'/[locale]/admin/duyet-ho'>) {
  await resolveLocale(params);
  return <HouseholdQueue />;
}
