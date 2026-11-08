import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RfqForm } from '@/features/rfq/rfq-form';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/moi'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('rfq.form');
  return { title: t('onBehalf.title'), robots: { index: false } };
}

/** An administrator creates a request for an off-platform customer (FR-ORD-10). */
export default async function NewCustomerRfqPage({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/moi'>) {
  await resolveLocale(params);
  return (
    <div className="mx-auto max-w-prose-vn">
      <RfqForm onBehalf />
    </div>
  );
}
