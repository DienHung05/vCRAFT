'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { ContributionDto, RfqResponse } from '@vcraft/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { ContributionForm, type ContributionFormValues } from './contribution-form';

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | { kind: 'ready'; request: RfqResponse; contribution: ContributionDto | null };

export function LiveContributionWorkspace({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const t = useTranslations('contribution');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <p>{t('loading')}</p>;
  if (!client) return <p>{t('signIn')}</p>;
  return <ContributionWorkspace key={rfqId} rfqId={rfqId} client={client} />;
}

function ContributionWorkspace({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('contribution');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads the contribution after a saved edit or withdrawal.
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const current = ++sequence;
      try {
        const [request, offers] = await Promise.all([
          client.getRequest(rfqId),
          client.listOwnContributions(rfqId),
        ]);
        if (active && current === sequence)
          setState({ kind: 'ready', request, contribution: offers[0] ?? null });
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
  }, [client, rfqId, refresh]);

  if (state.kind === 'loading') return <p>{t('loading')}</p>;
  if (state.kind === 'unauthenticated') return <p>{t('signIn')}</p>;
  if (state.kind === 'error') return <p role="alert">{t('notFound')}</p>;
  const { request, contribution } = state;
  const closed =
    !['SENT', 'BIDDING'].includes(request.status) ||
    new Date(request.biddingClosesAt).getTime() <= Date.now();
  const submit = async (values: ContributionFormValues) => {
    try {
      if (contribution)
        await client.updateContribution(contribution.id, contribution.version, values);
      else await client.createContribution(rfqId, values);
      setRefresh((value) => value + 1);
    } catch {
      throw new Error(t('sendFailed'));
    }
  };
  const withdraw = async () => {
    if (!contribution) return;
    try {
      await client.withdrawContribution(contribution.id, contribution.version);
      setRefresh((value) => value + 1);
    } catch {
      throw new Error(t('sendFailed'));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h2">{request.design}</h1>
      {closed ? <p>{t('closed')}</p> : null}
      <ContributionForm
        key={contribution?.version ?? 'new'}
        rfqCode={request.id}
        quantity={request.quantity}
        unit={request.unit}
        biddingClosesAt={request.biddingClosesAt}
        requiredBy={request.requiredBy}
        disabled={closed}
        onSubmit={submit}
        {...(contribution
          ? {
              initial: contribution,
              version: contribution.version,
              withdrawn: contribution.status === 'WITHDRAWN',
            }
          : {})}
        {...(contribution?.status === 'ACTIVE' ? { onWithdraw: withdraw } : {})}
      />
    </div>
  );
}
