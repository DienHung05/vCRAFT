import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RfqForm } from '@/features/rfq/rfq-form';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia/moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('rfq.form');
  return { title: t('title'), robots: { index: false } };
}

export default async function NewRfqPage({ params }: PageProps<'/[locale]/yeu-cau-bao-gia/moi'>) {
  await resolveLocale(params);
  return <RfqForm />;
}
