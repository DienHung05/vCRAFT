'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { MyAllocationDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AllocationCard } from '@/features/orders/allocation-card';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

/** The household's shares across orders (FR-ORD-05 … 07). */
export function StudioAllocations({
  client: provided,
  uploadPhoto,
}: {
  client?: QuotationClient;
  uploadPhoto?: (client: QuotationClient, file: File) => Promise<string>;
}) {
  const t = useTranslations('studio.allocations');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('loading')}</p>;
  if (!client) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('signIn')}</p>;
  return <Allocations client={client} uploadPhoto={uploadPhoto} />;
}

function Allocations({
  client,
  uploadPhoto,
}: {
  client: QuotationClient;
  uploadPhoto?: ((client: QuotationClient, file: File) => Promise<string>) | undefined;
}) {
  const t = useTranslations('studio.allocations');
  const allocation = useTranslations('allocation');
  const statuses = useTranslations('rfq.status');
  const format = useFormatter();
  const [rows, setRows] = useState<readonly MyAllocationDto[] | null>(null);
  const [state, setState] = useState<'ok' | 'failed' | 'signed-out'>('ok');
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState<'stale' | 'loadFailed' | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await client.listMyAllocations());
      setState('ok');
    } catch (error) {
      setState(
        error instanceof QuotationApiError && error.status === 401 ? 'signed-out' : 'failed',
      );
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setActionFailed(null);
    try {
      await action();
    } catch (error) {
      setActionFailed(
        error instanceof QuotationApiError && error.code === 'STALE_VERSION'
          ? 'stale'
          : 'loadFailed',
      );
    } finally {
      await load();
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {actionFailed ? (
        <p role="alert" className="text-seal">
          {allocation(actionFailed)}
        </p>
      ) : null}
      {state === 'signed-out' ? (
        <p>{t('signIn')}</p>
      ) : state === 'failed' ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t('failed')}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <p role="status">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-ash">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="studio-allocations">
          {rows.map((row) => (
            <li key={`${row.id}-${row.version}`}>
              <AllocationCard
                allocation={row}
                client={client}
                busy={busy}
                run={run}
                unit={row.unit}
                {...(uploadPhoto ? { uploadPhoto } : {})}
              >
                <h2 className="text-h3 break-words">
                  <Link
                    href={{
                      pathname: '/studio/de-xuat-tham-gia/[id]',
                      params: { id: row.requestId },
                    }}
                    className="hover:text-clay"
                  >
                    {row.requestTitle}
                  </Link>
                </h2>
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-small">
                  <div className="flex gap-2">
                    <dt className="text-ash">{t('orderStatus')}</dt>
                    <dd>{statuses(row.requestStatus)}</dd>
                  </div>
                  {row.completionDate ? (
                    <div className="flex gap-2">
                      <dt className="text-ash">{t('promised')}</dt>
                      <dd>{format.dateTime(new Date(row.completionDate), 'short')}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="text-ash">{t('requiredBy')}</dt>
                    <dd>{format.dateTime(new Date(row.requiredBy), 'short')}</dd>
                  </div>
                </dl>
              </AllocationCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
