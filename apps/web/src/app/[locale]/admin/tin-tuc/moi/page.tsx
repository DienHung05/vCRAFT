import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminNewsForm } from '@/features/admin/admin-news-form';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/tin-tuc/moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.news');
  return { title: t('newTitle'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/admin/tin-tuc/moi'>) {
  await resolveLocale(params);
  return <AdminNewsForm />;
}
