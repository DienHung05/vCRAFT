import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { fetchTrace } from '@/features/catalog/exhibition-api';
import { RfqForm } from '@/features/rfq/rfq-form';
import type { RfqFormPrefill } from '@/features/rfq/rfq-form-model';
import { firstParam } from '@/lib/auth/return-to';
import { resolveLocale } from '@/lib/locale';
import { isTraceCode } from '@/lib/site';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia/moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('rfq.form');
  return { title: t('title'), robots: { index: false } };
}

/** Seeds the form from `?product=<trace code>`; an unknown or malformed code leaves it empty. */
async function productPrefill(code: string | undefined): Promise<RfqFormPrefill | undefined> {
  if (!code || !isTraceCode(code)) return undefined;
  const result = await fetchTrace(code);
  if (result.status !== 'ok' || result.data.availability !== 'VISIBLE') return undefined;
  const { product, household } = result.data;
  // A sold piece cannot start a new quotation request.
  if (product.status === 'SOLD') return undefined;
  const t = await getTranslations('rfq.form');
  return {
    title: product.name,
    category: product.category,
    description: t('prefillDescription', {
      product: product.name,
      household: household.name,
      code: product.traceCode,
    }),
  };
}

export default async function NewRfqPage({
  params,
  searchParams,
}: PageProps<'/[locale]/yeu-cau-bao-gia/moi'>) {
  await resolveLocale(params);
  const prefill = await productPrefill(firstParam((await searchParams).product)?.trim());
  return prefill ? <RfqForm prefill={prefill} /> : <RfqForm />;
}
