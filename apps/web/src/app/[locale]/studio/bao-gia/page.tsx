import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { QuotationInvitations } from '@/features/studio/quotation-invitations';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/studio/bao-gia'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('studio.invitations');
  return { title: t('title'), robots: { index: false } };
}

export default async function Page({ params }: PageProps<'/[locale]/studio/bao-gia'>) {
  await resolveLocale(params);
  return <QuotationInvitations />;
}
