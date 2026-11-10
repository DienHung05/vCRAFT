import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DemoConfirmPage } from '@/features/payments/demo-confirm-page';
import { firstParam } from '@/lib/auth/return-to';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/thanh-toan/thu/[ref]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('payments.demoConfirm');
  // The link carries a per-payment secret: keep it out of search results and out of the Referer header.
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

/**
 * Demo payment mode (ADR-0025): the public page a payment's QR code opens on a phone, not behind sign-in. The
 * secret in `?k=` is the credential; the API answers 404 unless demo mode is on and the secret matches.
 */
export default async function DemoPaymentPage({
  params,
  searchParams,
}: PageProps<'/[locale]/thanh-toan/thu/[ref]'>) {
  await resolveLocale(params);
  const { ref } = await params;
  if (!/^[A-Z0-9]{6,40}$/.test(ref)) notFound();
  const query = await searchParams;
  const token = firstParam(query.k)?.trim() || null;
  return <DemoConfirmPage reference={ref} token={token} />;
}
