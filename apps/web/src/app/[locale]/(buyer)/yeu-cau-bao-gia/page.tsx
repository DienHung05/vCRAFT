import { Badge, Card } from '@vcraft/ui';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getRfqs } from '@/lib/demo/data';
import { resolveLocale } from '@/lib/locale';

// Hạn chào giá của dữ liệu mẫu tính theo thời điểm hiện tại, nên dựng lại định kỳ.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/yeu-cau-bao-gia'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('indexPages.rfq');
  return { title: t('title'), description: t('lead'), robots: { index: false } };
}

/** Danh sách yêu cầu báo giá (FR-RFQ): liệt kê các yêu cầu mẫu, mở chi tiết để so sánh chào giá. */
export default async function RfqIndexPage({ params }: PageProps<'/[locale]/yeu-cau-bao-gia'>) {
  await resolveLocale(params);
  const [t, common, status, format, rfqs] = await Promise.all([
    getTranslations('indexPages.rfq'),
    getTranslations('indexPages'),
    getTranslations('rfq.status'),
    getFormatter(),
    getRfqs(),
  ]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <Badge tone="outline" className="self-start whitespace-normal">
          {common('demoNote')}
        </Badge>
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
        <p className="text-small text-ash">{t('count', { count: rfqs.length })}</p>
      </header>
      {rfqs.length > 0 ? (
        <ul className="mt-10 flex flex-col gap-4">
          {rfqs.map((r) => (
            <li key={r.code}>
              <Card className="p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3 text-small text-ash">
                  <span className="font-mono text-ink">{r.code}</span>
                  <Badge tone="clay">{status(r.status)}</Badge>
                </div>
                <h2 className="mt-2 text-h3">
                  <Link
                    href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: r.code } }}
                    className="transition-colors hover:text-clay"
                  >
                    {r.title}
                  </Link>
                </h2>
                <p className="mt-2 text-small text-ash">
                  {t('quantity', { quantity: format.number(r.quantity), unit: r.unit })} ·{' '}
                  {t('bids', { count: r.bids.length })} ·{' '}
                  {t('closes', { date: format.dateTime(new Date(r.biddingClosesAt), 'short') })}
                </p>
                <Link
                  href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: r.code } }}
                  className="mt-4 inline-block text-small text-clay underline underline-offset-4"
                >
                  {t('open')} →
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-ash">{t('empty')}</p>
      )}
    </div>
  );
}
