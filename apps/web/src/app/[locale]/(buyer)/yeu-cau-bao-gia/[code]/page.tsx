import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RfqSummary } from '@/features/rfq/rfq-summary';
import { RfqWorkspace } from '@/features/rfq/rfq-workspace';
import { Link } from '@/i18n/navigation';
import { demoParams, getRfq } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

export function generateStaticParams() {
  return demoParams.rfqs.map((code) => ({ code }));
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia/[code]'>): Promise<Metadata> {
  const { code } = await params;
  const rfq = await getRfq(code);
  return rfq ? { title: rfq.title, robots: { index: false } } : {};
}

/**
 * Chi tiết yêu cầu báo giá của Buyer (FR-RFQ-07/08/12, BRAND §9): stepper trạng thái → tóm tắt →
 * bảng so sánh chào giá có highlight tốt nhất theo cột → chốt.
 */
export default async function RfqPage({ params }: PageProps<'/[locale]/yeu-cau-bao-gia/[code]'>) {
  await resolveLocale(params);
  const { code } = await params;
  const rfq = await getRfq(code);
  if (!rfq) notFound();
  const t = await getTranslations('rfq');

  return (
    <article className="mx-auto max-w-editorial px-gutter pt-8">
      <nav aria-label={t('breadcrumb')} className="mb-6 text-small text-ash">
        <Link href="/yeu-cau-bao-gia" className="hover:text-ink">
          {t('allRequests')}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page" className="font-mono text-ink">
          {rfq.code}
        </span>
      </nav>

      <header className="mb-10 flex flex-col gap-2">
        <p className="text-small text-ash">{rfq.category}</p>
        <h1 className="text-h1">{rfq.title}</h1>
      </header>

      <RfqWorkspace rfq={rfq}>
        <RfqSummary rfq={rfq} />
      </RfqWorkspace>
    </article>
  );
}
