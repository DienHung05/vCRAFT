import { Card } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import type { Rfq } from '@/lib/demo/data';
import { DeadlineCountdown } from './deadline-countdown';

/** Khối tóm tắt yêu cầu (FR-RFQ-12): số lượng, ngân sách, các hạn, yêu cầu riêng, nơi giao, số hộ được mời. */
export async function RfqSummary({ rfq }: { rfq: Rfq }) {
  const [t, format] = await Promise.all([getTranslations('rfq.summary'), getFormatter()]);
  const money = (v: number) => format.number(v, 'vnd');
  const day = (iso: string) => format.dateTime(new Date(iso), 'long');

  return (
    <section aria-labelledby="summary-title">
      <h2 id="summary-title" className="sr-only">
        {t('title')}
      </h2>
      <Card className="grid gap-x-10 gap-y-6 p-6 md:grid-cols-2 md:p-8 xl:grid-cols-4">
        <dl className="contents">
          <Item label={t('quantity')}>
            <span className="font-display text-h3 type-soft">{format.number(rfq.quantity)}</span>{' '}
            <span className="text-ash">{rfq.unit}</span>
          </Item>
          <Item label={t('budget')}>
            {t('budgetRange', { min: money(rfq.budgetMin), max: money(rfq.budgetMax) })}
          </Item>
          <Item label={t('biddingCloses')}>
            <time dateTime={rfq.biddingClosesAt}>{day(rfq.biddingClosesAt)}</time>
            <span className="block text-small">
              <DeadlineCountdown until={rfq.biddingClosesAt} />
            </span>
          </Item>
          <Item label={t('requiredBy')}>
            <time dateTime={rfq.requiredBy}>{day(rfq.requiredBy)}</time>
          </Item>
          <Item label={t('customization')} className="md:col-span-2">
            {rfq.customization || <span className="text-ash">{t('noCustomization')}</span>}
          </Item>
          <Item label={t('deliverTo')} className="md:col-span-2">
            {rfq.deliverTo}
          </Item>
        </dl>
        <p className="border-ink/10 border-t pt-4 text-small text-ash md:col-span-2 xl:col-span-4">
          {t('invited', { count: rfq.invitedCount })}
        </p>
      </Card>
    </section>
  );
}

function Item({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <dt className="text-small text-ash">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
