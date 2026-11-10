'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { RfqListItemDto } from '@vcraft/contracts';
import { RFQ_STATUSES, type RfqStatus } from '@vcraft/domain';
import { Badge, Button, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { useLatestRequest } from '@/lib/use-latest-request';

/** The signed-in buyer's requests from `GET /rfqs`, with a status filter and cursor paging. */
export function BuyerRfqList({ client: provided }: { client?: QuotationClient }) {
  const t = useTranslations('rfq.list');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <ListSkeleton label={t('loading')} />;
  if (!client) return <p className="px-gutter pt-8">{t('signIn')}</p>;
  return <List client={client} />;
}

function List({ client }: { client: QuotationClient }) {
  const t = useTranslations('rfq.list');
  const page = useTranslations('indexPages.rfq');
  const statuses = useTranslations('rfq.status');
  const format = useFormatter();
  const [status, setStatus] = useState<RfqStatus | undefined>();
  const [rows, setRows] = useState<readonly RfqListItemDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<'ok' | 'failed' | 'signed-out'>('ok');
  const [loadingMore, setLoadingMore] = useState(false);
  const latest = useLatestRequest();

  const fail = useCallback(
    (error: unknown) =>
      setState(
        error instanceof QuotationApiError && error.status === 401 ? 'signed-out' : 'failed',
      ),
    [],
  );

  const load = useCallback(async () => {
    const id = latest.begin();
    setState('ok');
    setRows(null);
    setLoadingMore(false);
    try {
      const result = await client.listRequests({ ...(status ? { status } : {}) });
      if (!latest.isCurrent(id)) return;
      setRows(result.data);
      setCursor(result.nextCursor);
    } catch (error) {
      if (latest.isCurrent(id)) fail(error);
    }
  }, [client, status, fail, latest]);

  useEffect(() => {
    void load();
  }, [load]);

  const more = async () => {
    if (!cursor || loadingMore) return;
    // Does not begin a new request: a filter change must still supersede this page.
    const id = latest.peek();
    setLoadingMore(true);
    try {
      const result = await client.listRequests({ ...(status ? { status } : {}), cursor });
      if (!latest.isCurrent(id)) return;
      setRows((current) => [...(current ?? []), ...result.data]);
      setCursor(result.nextCursor);
    } catch (error) {
      if (latest.isCurrent(id)) fail(error);
    } finally {
      if (latest.isCurrent(id)) setLoadingMore(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-editorial flex-col gap-8 px-gutter pt-12 pb-section">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-prose-vn flex-col gap-3">
          <h1 className="text-h1">{page('title')}</h1>
          <p className="text-ash">{page('lead')}</p>
        </div>
        <Link href="/yeu-cau-bao-gia/moi" className={buttonVariants()}>
          {t('new')}
        </Link>
      </header>
      <label className="flex max-w-xs flex-col gap-1 text-small">
        {t('statusFilter')}
        <select
          value={status ?? ''}
          onChange={(event) =>
            setStatus((event.target.value || undefined) as RfqStatus | undefined)
          }
          className="rounded-input border border-ink/20 bg-surface px-2 py-1.5"
        >
          <option value="">{t('allStatuses')}</option>
          {RFQ_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statuses(value)}
            </option>
          ))}
        </select>
      </label>
      {state === 'signed-out' ? (
        <p>{t('signIn')}</p>
      ) : state === 'failed' ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : rows === null ? (
        <ListSkeleton label={t('loading')} className="" rows={3} withHeader={false} />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="scroll"
          title={status ? t('emptyFiltered') : t('emptyTitle')}
          description={status ? undefined : page('empty')}
          action={
            status ? (
              <Button type="button" variant="secondary" onClick={() => setStatus(undefined)}>
                {t('clearFilter')}
              </Button>
            ) : (
              <Link href="/yeu-cau-bao-gia/moi" className={buttonVariants()}>
                {t('new')}
              </Link>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-4" data-testid="buyer-rfqs">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-col gap-2 p-5 md:p-6">
                <Badge tone="clay" className="self-start">
                  {statuses(row.status)}
                </Badge>
                <h2 className="text-h3 break-words">
                  <Link
                    href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: row.id } }}
                    className="transition-colors hover:text-clay"
                  >
                    {row.title}
                  </Link>
                </h2>
                <p className="text-small text-ash">
                  {page('quantity', { quantity: format.number(row.quantity), unit: row.unit })} ·{' '}
                  {t('quotations', { count: row.openQuotationCount })} ·{' '}
                  {page('closes', {
                    date: format.dateTime(new Date(row.biddingClosesAt), 'short'),
                  })}
                </p>
                <Link
                  href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: row.id } }}
                  className="text-small text-clay underline underline-offset-4"
                >
                  {row.status === 'DRAFT' ? t('continueDraft') : page('open')}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {state === 'ok' && cursor ? (
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          disabled={loadingMore}
          onClick={() => void more()}
        >
          {t('more')}
        </Button>
      ) : null}
    </div>
  );
}
