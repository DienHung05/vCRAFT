import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PaymentStatusPage } from '@/features/payments/payment-status-page';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/thanh-toan/[ref]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('payments.result');
  return { title: t('title'), robots: { index: false } };
}

/** The status of one payment, read from the API by its payment code and refreshed until it is final. */
export default async function PaymentPage({ params }: PageProps<'/[locale]/thanh-toan/[ref]'>) {
  await resolveLocale(params);
  const { ref } = await params;
  if (!/^[A-Z0-9]{6,40}$/.test(ref)) notFound();
  return <PaymentStatusPage reference={ref} />;
}
