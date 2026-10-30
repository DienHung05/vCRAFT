'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto, RfqResponse } from '@vcraft/contracts';
import { Badge, Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message?: string | undefined }
  | { kind: 'ready'; request: RfqResponse; allocations: AllocationDto[] };

/** GH#11: buyer theo dõi allocations của đơn đã chốt, xác nhận receipt khi xong. */
export function LiveBuyerOrder({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const { client, loading } = useQuotationClient(provided);
  const t = useTranslations('order');
  if (loading) return <p>{t('loading')}</p>;
  if (!client) return <p>{t('signIn')}</p>;
  return <BuyerOrder key={rfqId} rfqId={rfqId} client={client} />;
}

function BuyerOrder({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('order');
  const format = useFormatter();
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads the order after an action.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [request, allocations] = await Promise.all([
          client.getRequest(rfqId),
          client.listAllocations(rfqId).catch(() => [] as AllocationDto[]),
        ]);
        if (active) setState({ kind: 'ready', request, allocations });
      } catch (error) {
        if (!active) return;
        if (error instanceof QuotationApiError && error.status === 401) {
          setState({ kind: 'unauthenticated' });
        } else if (error instanceof QuotationApiError) {
          setState({ kind: 'error', message: error.code });
        } else {
          setState({ kind: 'error' });
        }
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 10_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [client, rfqId, refresh]);

  if (state.kind === 'loading') return <p>{t('loading')}</p>;
  if (state.kind === 'unauthenticated') return <p>{t('signIn')}</p>;
  if (state.kind === 'error')
    return <p role="alert">{state.message === 'STALE_VERSION' ? t('stale') : t('loadFailed')}</p>;

  const { request, allocations } = state;
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      setRefresh((value) => value + 1);
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof QuotationApiError ? error.code : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h1 id={titleId} className="text-h2">
        {t('title')}
      </h1>
      <p>
        <Badge>{t(`status.${request.status}`)}</Badge>
      </p>
      {allocations.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {allocations.map((allocation) => (
            <li key={allocation.id}>
              <Card className="flex flex-col gap-2 p-4">
                <Badge>{t(`allocation.${allocation.status}`)}</Badge>
                <p>
                  {format.number(allocation.completedQty)} / {format.number(allocation.quantity)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('noAllocations')}</p>
      )}
      {request.status === 'IN_PRODUCTION' ? (
        <Button
          disabled={busy}
          onClick={() => void run(() => client.confirmReceipt(rfqId, request.version))}
        >
          {t('receive')}
        </Button>
      ) : null}
    </section>
  );
}
