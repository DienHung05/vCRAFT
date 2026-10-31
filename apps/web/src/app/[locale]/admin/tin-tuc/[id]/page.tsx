import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AdminNewsForm } from '@/features/admin/admin-news-form';
import { isRfqUuid } from '@/lib/api/rfq-id';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/tin-tuc/[id]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.news');
  return { title: t('editTitle'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/admin/tin-tuc/[id]'>) {
  await resolveLocale(params);
  const { id } = await params;
  if (!isRfqUuid(id)) notFound();
  return <AdminNewsForm newsId={id} />;
}
