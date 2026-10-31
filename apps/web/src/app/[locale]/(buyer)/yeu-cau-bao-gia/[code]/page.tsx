import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BuyerRfqDetail } from '@/features/rfq/buyer-rfq-detail';
import { isRfqUuid } from '@/lib/api/rfq-id';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia/[code]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.rfq');
  return { title: t('title'), robots: { index: false } };
}

/** One quotation request of the buyer (FR-RFQ-07, 08, 09, 12), read from the API. */
export default async function RfqPage({ params }: PageProps<'/[locale]/yeu-cau-bao-gia/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  if (!isRfqUuid(code)) notFound();
  return <BuyerRfqDetail rfqId={code} />;
}
