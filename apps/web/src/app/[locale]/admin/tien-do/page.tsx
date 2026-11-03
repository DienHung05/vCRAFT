import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AllocationGantt } from '@/features/admin/allocation-gantt';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/tien-do'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.progress');
  return { title: t('title'), robots: { index: false } };
}

/** Allocation timeline per household with lateness warnings and reallocation (PLAN E10). */
export default async function AllocationProgressPage({
  params,
}: PageProps<'/[locale]/admin/tien-do'>) {
  await resolveLocale(params);
  return <AllocationGantt />;
}
