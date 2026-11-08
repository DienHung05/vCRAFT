import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminAccounts } from '@/features/admin/admin-accounts';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/nguoi-dung'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.accounts');
  return { title: t('title'), robots: { index: false } };
}

export default async function AdminAccountsPage({
  params,
}: PageProps<'/[locale]/admin/nguoi-dung'>) {
  await resolveLocale(params);
  return <AdminAccounts />;
}
