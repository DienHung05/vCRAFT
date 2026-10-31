import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { JournalEditor } from '@/features/studio/journal-editor';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/san-pham/[id]/nhat-ky'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.journal');
  return { title: t('template'), robots: { index: false } };
}

export default async function Page({
  params,
}: PageProps<'/[locale]/studio/san-pham/[id]/nhat-ky'>) {
  await resolveLocale(params);
  const { id } = await params;
  return <JournalEditor productId={id} />;
}
