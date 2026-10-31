import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CoordinationQueue } from '@/features/admin/coordination-queue';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.coordinationQueue');
  return { title: t('title'), robots: { index: false } };
}

export default async function CoordinationQueuePage({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi'>) {
  await resolveLocale(params);
  return <CoordinationQueue />;
}
