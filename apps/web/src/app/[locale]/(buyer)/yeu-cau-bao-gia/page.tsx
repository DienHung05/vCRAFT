import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BuyerRfqList } from '@/features/rfq/buyer-rfq-list';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.rfq');
  return { title: t('title'), description: t('lead'), robots: { index: false } };
}

/** The signed-in buyer's quotation requests (FR-RFQ), read from the API. */
export default async function RfqIndexPage({ params }: PageProps<'/[locale]/yeu-cau-bao-gia'>) {
  await resolveLocale(params);
  return <BuyerRfqList />;
}
