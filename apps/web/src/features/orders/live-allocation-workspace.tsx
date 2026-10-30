'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error'; message?: string | undefined }
  | { kind: 'ready'; allocations: AllocationDto[] };

/** GH#11: hộ CONFIRM/DECLINE phân bổ, báo cáo tiến độ 0..quantity. */
export function LiveAllocationWorkspace({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const { client, loading } = useQuotationClient(provided);
  const t = useTranslations('allocation');
  if (loading) return <p>{t('loading')}</p>;
  if (!client) return <p>{t('signIn')}</p>;
  return <AllocationWorkspace key={rfqId} rfqId={rfqId} client={client} />;
}

function AllocationWorkspace({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('allocation');
  const format = useFormatter();
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads the allocations after confirm, decline and progress reports.
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const allocations = await client.listAllocations(rfqId);
        if (active) setState({ kind: 'ready', allocations });
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
      {state.allocations.map((allocation) => (
        <Card key={allocation.id} className="flex flex-col gap-2 p-4">
          <p>
            {format.number(allocation.completedQty)} / {format.number(allocation.quantity)}
          </p>
          <p>{t(`status.${allocation.status}`)}</p>
          {allocation.status === 'PROPOSED' ? (
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() => client.confirmAllocation(allocation.id, allocation.version))
                }
              >
                {t('confirm')}
              </Button>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() => client.declineAllocation(allocation.id, allocation.version))
                }
              >
                {t('decline')}
              </Button>
            </div>
          ) : null}
          {allocation.status === 'IN_PROGRESS' ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const raw = amounts[allocation.id] ?? '';
                const completedQty = raw.trim() === '' ? Number.NaN : Number(raw);
                void run(() =>
                  client.reportProgress(allocation.id, allocation.version, { completedQty }),
                );
              }}
            >
              <input
                aria-label={t('completedQty')}
                className="h-10 rounded-input border border-ink/20 bg-paper px-2 text-right tabular-nums"
                inputMode="numeric"
                value={amounts[allocation.id] ?? ''}
                onChange={(event) =>
                  setAmounts((prev) => ({ ...prev, [allocation.id]: event.target.value }))
                }
              />
              <Button type="submit" disabled={busy}>
                {t('report')}
              </Button>
            </form>
          ) : null}
        </Card>
      ))}
    </section>
  );
}
