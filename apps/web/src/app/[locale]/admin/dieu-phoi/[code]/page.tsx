import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LiveCoordination } from '@/features/admin/live-coordination';
import { Link } from '@/i18n/navigation';
import { isRfqUuid } from '@/lib/api/rfq-id';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/[code]'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('admin.coordinationQueue');
  return { title: t('title'), robots: { index: false } };
}

/** Coordination workspace of one quotation request. Everything on it comes from the API. */
export default async function CoordinationPage({
  params,
}: PageProps<'/[locale]/admin/dieu-phoi/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  if (!isRfqUuid(code)) notFound();
  const t = await getTranslations('admin.coordinationQueue');
  return (
    <article className="mx-auto flex max-w-6xl flex-col gap-8">
      <nav aria-label={t('breadcrumb')} className="text-small text-ash">
        <Link href="/admin/dieu-phoi" className="hover:text-clay">
          {t('title')}
        </Link>
      </nav>
      <LiveCoordination rfqId={code} />
    </article>
  );
}
