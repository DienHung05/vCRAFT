import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminDashboard } from '@/features/admin/admin-dashboard';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.dashboard');
  return { title: t('title'), robots: { index: false } };
}

/** Tổng quan của Ban quản lý, cũng là đích sau đăng nhập của Admin. */
export default async function AdminIndexPage({ params }: PageProps<'/[locale]/admin'>) {
  await resolveLocale(params);
  return <AdminDashboard />;
}
