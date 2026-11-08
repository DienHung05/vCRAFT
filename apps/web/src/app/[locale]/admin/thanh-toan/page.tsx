import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminPaymentsList } from '@/features/admin/admin-payments-list';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/thanh-toan'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.payments');
  return { title: t('title'), robots: { index: false } };
}

export default async function AdminPaymentsPage({
  params,
}: PageProps<'/[locale]/admin/thanh-toan'>) {
  await resolveLocale(params);
  return <AdminPaymentsList />;
}
