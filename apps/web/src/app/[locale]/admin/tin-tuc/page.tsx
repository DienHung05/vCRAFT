import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AdminNewsList } from '@/features/admin/admin-news-list';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/tin-tuc'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.news');
  return { title: t('title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/admin/tin-tuc'>) {
  await resolveLocale(params);
  return <AdminNewsList />;
}
