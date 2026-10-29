'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { BuyerQuotationDto } from '@vcraft/contracts';
import { Badge, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | { kind: 'ready'; quotations: BuyerQuotationDto[]; noticeCount: number };

export function LiveBuyerQuotations({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const { client, loading } = useQuotationClient(provided);
  const t = useTranslations('rfq.live');
  if (loading) return <p>{t('loading')}</p>;
  if (!client) return <p>{t('signIn')}</p>;
  return <BuyerQuotations key={rfqId} rfqId={rfqId} client={client} />;
}

function BuyerQuotations({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('rfq.live');
  const bids = useTranslations('rfq.bids');
  const format = useFormatter();
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const current = ++sequence;
      try {
        const [quotations, notices] = await Promise.all([
          client.listBuyerQuotations(rfqId),
          client.listNotices(),
        ]);
        if (active && current === sequence)
          setState({
            kind: 'ready',
            quotations,
            noticeCount: notices.filter((notice) => notice.requestId === rfqId).length,
          });
      } catch (error) {
        if (active && current === sequence)
          setState({
            kind:
              error instanceof QuotationApiError && error.status === 401
                ? 'unauthenticated'
                : 'error',
          });
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 10_000);
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [client, rfqId]);

  if (state.kind === 'loading') return <p>{t('loading')}</p>;
  if (state.kind === 'unauthenticated') return <p>{t('signIn')}</p>;
  if (state.kind === 'error') return <p role="alert">{t('loadFailed')}</p>;
  const money = (amount: number) => format.number(amount, 'vnd');
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <h1 id={titleId} className="text-h2">
        {bids('title')}
      </h1>
      <p className="font-mono text-small text-ash">{rfqId}</p>
      {state.noticeCount > 0 ? (
        <p role="status" className="rounded-card bg-lacquer/10 p-4">
          {t('notice')}
        </p>
      ) : null}
      {state.quotations.length === 0 ? <p>{bids('empty')}</p> : null}
      {state.quotations.map((quotation) => (
        <Card key={quotation.id} className="flex flex-col gap-4 p-6">
          <Badge>{bids(`status.${quotation.status}`)}</Badge>
          <ul className="flex flex-col gap-2">
            {quotation.parts.map((part) => (
              <li key={part.householdId} className="flex flex-wrap gap-x-4">
                <span>{part.householdName}</span>
                <span>{format.number(part.quantity)}</span>
                <time dateTime={part.completionDate}>
                  {format.dateTime(new Date(part.completionDate), 'short')}
                </time>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-[1fr_auto] gap-2">
            <dt>{t('productionTotal')}</dt>
            <dd>{money(quotation.productionTotalVnd)}</dd>
            <dt>{t('additionalCharge')}</dt>
            <dd>{money(quotation.additionalChargeVnd)}</dd>
            <dt>{t('total')}</dt>
            <dd className="font-semibold">{money(quotation.totalVnd)}</dd>
          </dl>
          <p className="text-small text-ash">
            {t(quotation.deliveryTerms === 'INCLUDED' ? 'deliveryIncluded' : 'deliverySeparate')}
          </p>
        </Card>
      ))}
    </section>
  );
}
