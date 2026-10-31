import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HouseholdReview } from '@/features/admin/household-review';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/duyet-ho/[id]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.queue');
  return { title: t('title'), robots: { index: false } };
}

export default async function HouseholdReviewPage({
  params,
}: PageProps<'/[locale]/admin/duyet-ho/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  return <HouseholdReview householdId={id} />;
}
