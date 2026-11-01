'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto } from '@vcraft/contracts';
import { buttonVariants } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { notify } from '@/lib/notify';
import { AllocationCard } from './allocation-card';

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
  if (loading)
    return <ListSkeleton label={t('loading')} className="" rows={1} withHeader={false} />;
  if (!client) return <p>{t('signIn')}</p>;
  return <AllocationWorkspace key={rfqId} rfqId={rfqId} client={client} />;
}

function AllocationWorkspace({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('allocation');
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);

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

  if (state.kind === 'loading')
    return <ListSkeleton label={t('loading')} className="" rows={1} withHeader={false} />;
  if (state.kind === 'unauthenticated') return <p>{t('signIn')}</p>;
  if (state.kind === 'error')
    return (
      <ErrorState
        message={state.message === 'STALE_VERSION' ? t('stale') : t('loadFailed')}
        onRetry={() => {
          setState({ kind: 'loading' });
          setRefresh((value) => value + 1);
        }}
      />
    );

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await action();
      setRefresh((value) => value + 1);
      if (success) notify.success(success);
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
      {state.allocations.length === 0 ? (
        <EmptyState
          illustration="scroll"
          headingLevel="h2"
          title={t('empty')}
          action={
            <Link href="/studio/don-hang" className={buttonVariants({ variant: 'secondary' })}>
              {t('emptyAction')}
            </Link>
          }
        />
      ) : null}
      {state.allocations.map((allocation) => (
        <AllocationCard
          key={allocation.id}
          allocation={allocation}
          client={client}
          busy={busy}
          run={run}
        />
      ))}
    </section>
  );
}
