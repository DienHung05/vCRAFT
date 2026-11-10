'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type {
  AllocationDto,
  CoordinationDto,
  InternalQuotationDto,
  RfqResponse,
} from '@vcraft/contracts';
import { Badge, Button, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { DashboardSkeleton } from '@/components/states/skeletons';
import { HouseholdRatings } from '@/features/rfq/household-ratings';
import { Link } from '@/i18n/navigation';
import { useLiveEvents } from '@/lib/api/live-events';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { useMoney } from '@/lib/use-money';
import { AllocationBoard, type BoardSubmitPayload } from './allocation-board';

type LiveState =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'notFound' }
  | { kind: 'claimable'; request: RfqResponse }
  | {
      kind: 'ready';
      coordination: CoordinationDto;
      noticeCount: number;
      /** Only for a request made for an off-platform customer: what the buyer would otherwise see. */
      customer: { quotations: InternalQuotationDto[]; allocations: AllocationDto[] } | null;
    }
  | { kind: 'error' };

const biddingOpen = (request: RfqResponse) => ['SENT', 'BIDDING'].includes(request.status);
const deadlinePassed = (request: RfqResponse) =>
  new Date(request.biddingClosesAt).getTime() <= Date.now();
const requestClosed = (request: RfqResponse) => !biddingOpen(request) || deadlinePassed(request);

/** The coordinator's unsaved split plan, kept across the reload that follows a stale save (BR-L1). */
interface PlanDraft {
  /** The request version the failed save was made against. */
  baseVersion: number;
  quantities: ReadonlyMap<string, number>;
  additionalChargeVnd: number;
  deliveryTerms: 'INCLUDED' | 'SEPARATE';
}

export function LiveCoordination({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const t = useTranslations('admin.live');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <DetailSkeletonBlock label={t('loading')} />;
  if (!client) return <p>{t('signIn')}</p>;
  return <CoordinationWorkspace key={rfqId} rfqId={rfqId} client={client} />;
}

function DetailSkeletonBlock({ label }: { label: string }) {
  return <DashboardSkeleton label={label} className="" withTitle />;
}

function CoordinationWorkspace({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const t = useTranslations('admin.live');
  const rfq = useTranslations('rfq');
  const format = useFormatter();
  const money = useMoney();
  const draftRef = useRef<PlanDraft | null>(null);
  const [state, setState] = useState<LiveState>({ kind: 'loading' });
  const [refresh, setRefresh] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [dialog, setDialog] = useState<'start' | 'receive' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  // The quotation the administrator is about to accept for an off-platform customer.
  const [accepting, setAccepting] = useState<InternalQuotationDto | null>(null);
  // GH#444: a plan whose submit lost its response keeps its key and the version it was sent against,
  // even when polling later shows a newer (possibly our own committed) version. A changed plan starts over.
  const failedPlanRef = useRef<{ body: string; version: number } | null>(null);
  // GH#444: each retryable order action has its own action identity, so their keys never mix.
  const submitPlan = useIdempotentAction();
  const acceptCustomer = useIdempotentAction();
  const receiveOrder = useIdempotentAction();
  const cancelAcceptedOrder = useIdempotentAction();
  // A new offer, claim or allocation notice: reload now rather than at the next 10 s poll (GH#93).
  useLiveEvents((event) => {
    if (event.type === 'activity' && !document.hidden) setRefresh((n) => n + 1);
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh explicitly reloads after claims, stale writes and retries.
  useEffect(() => {
    let active = true;
    let sequence = 0;
    async function load() {
      const current = ++sequence;
      try {
        let coordination: CoordinationDto;
        try {
          coordination = await client.getCoordination(rfqId);
        } catch (error) {
          if (!(error instanceof QuotationApiError) || error.status !== 404) throw error;
          const request = await client.getRequest(rfqId);
          if (active && current === sequence) setState({ kind: 'claimable', request });
          return;
        }
        const notices = await client.listNotices();
        const customer = coordination.request.onBehalfOf
          ? await Promise.all([
              client.listInternalQuotations(rfqId),
              client.listAllocations(rfqId),
            ]).then(([quotations, allocations]) => ({ quotations, allocations }))
          : null;
        if (active && current === sequence)
          setState({
            kind: 'ready',
            coordination,
            customer,
            noticeCount: notices.filter(
              (notice) => notice.requestId === rfqId && notice.kind === 'QUOTATION_WITHDRAWN',
            ).length,
          });
      } catch (error) {
        if (!active || current !== sequence) return;
        setState({
          kind:
            error instanceof QuotationApiError && error.status === 401
              ? 'unauthenticated'
              : error instanceof QuotationApiError && error.status === 404
                ? 'notFound'
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

  // The board consumed the draft when it remounted on the new version; drop it so it is not replayed.
  useEffect(() => {
    if (
      state.kind === 'ready' &&
      draftRef.current?.baseVersion !== state.coordination.request.version
    )
      draftRef.current = null;
  }, [state]);

  if (state.kind === 'loading') return <DetailSkeletonBlock label={t('loading')} />;
  if (state.kind === 'unauthenticated') return <p>{t('signIn')}</p>;
  if (state.kind === 'notFound')
    return (
      <EmptyState
        illustration="magnifier"
        title={t('notFound')}
        action={
          <Link href="/admin/dieu-phoi" className={buttonVariants({ variant: 'secondary' })}>
            {t('backToQueue')}
          </Link>
        }
      />
    );
  if (state.kind === 'error')
    return (
      <ErrorState
        message={t('loadFailed')}
        onRetry={() => {
          setState({ kind: 'loading' });
          setRefresh((value) => value + 1);
        }}
      />
    );

  if (state.kind === 'claimable') {
    const claim = async () => {
      if (claiming || requestClosed(state.request)) return;
      setClaiming(true);
      try {
        await client.coordinate(rfqId, state.request.version);
        setRefresh((value) => value + 1);
        notify.success(t('claimedToast'));
      } catch {
        setState({ kind: 'error' });
      } finally {
        setClaiming(false);
      }
    };
    return (
      <Card className="flex flex-col gap-4 p-6">
        <p>{t('claimable')}</p>
        <Button disabled={claiming || requestClosed(state.request)} onClick={() => void claim()}>
          {t(claiming ? 'claiming' : 'claim')}
        </Button>
        {requestClosed(state.request) ? <p>{t('closed')}</p> : null}
      </Card>
    );
  }

  const { request, contributions } = state.coordination;
  // The split board and the bidding-deadline notice only belong to the bidding stage; after
  // acceptance the order screen shows the status and the order actions instead.
  const bidding = biddingOpen(request);
  const closed = bidding ? deadlinePassed(request) : request.status === 'EXPIRED';
  const pending = draftRef.current;
  const draft = pending && pending.baseVersion !== request.version ? pending : null;
  const activeOffers = contributions.filter((offer) => offer.status === 'ACTIVE');
  const submit = async (payload: BoardSubmitPayload) => {
    const body = {
      parts: [...payload.parts],
      additionalChargeVnd: payload.additionalChargeVnd,
      deliveryTerms: payload.deliveryTerms,
    };
    const serialized = JSON.stringify(body);
    const failed = failedPlanRef.current;
    // A retry of the same plan keeps the version it first failed against, even after a poll shows a
    // newer one (which may be our own committed write); a new plan uses the board's version.
    const version = failed && failed.body === serialized ? failed.version : payload.requestVersion;
    try {
      // The target, version and body make the retained action: a changed plan gets a new key.
      await submitPlan([rfqId, version, body], (options) =>
        client.submitQuotation(rfqId, version, body, options),
      );
      failedPlanRef.current = null;
      draftRef.current = null;
    } catch (error) {
      if (error instanceof QuotationApiError && error.code === 'STALE_VERSION') {
        failedPlanRef.current = null;
        // The board remounts on the new request version: hand the typed plan back to it.
        draftRef.current = {
          baseVersion: payload.requestVersion,
          quantities: new Map(payload.parts.map((part) => [part.householdId, part.quantity])),
          additionalChargeVnd: payload.additionalChargeVnd,
          deliveryTerms: payload.deliveryTerms,
        };
        setRefresh((value) => value + 1);
        throw new Error(t('stale'));
      }
      // A lost response is retryable: keep the plan and the version it was first sent against.
      failedPlanRef.current = { body: serialized, version };
      if (error instanceof QuotationApiError && error.code === 'RFQ_CAPACITY_EXCEEDED')
        throw new Error(t('capacityExceeded'));
      if (error instanceof QuotationApiError && error.code === 'RFQ_OFFER_QUANTITY_EXCEEDED')
        throw new Error(t('offerExceeded'));
      throw new Error(t('loadFailed'));
    }
  };
  // A failed order action keeps the page and reports through a toast; a stale one also reloads.
  const actionFailed = (error: unknown, fallback: string) => {
    if (error instanceof QuotationApiError && error.code === 'STALE_VERSION') {
      setRefresh((value) => value + 1);
      notify.error(t('stale'));
    } else notify.error(fallback);
  };
  const startProduction = async () => {
    try {
      await client.startProduction(rfqId, request.version);
      setRefresh((value) => value + 1);
      notify.success(t('productionStartedToast'));
    } catch (error) {
      actionFailed(error, t('startFailed'));
    }
  };
  const receive = async () => {
    try {
      await receiveOrder([rfqId, request.version], (options) =>
        client.confirmReceipt(rfqId, request.version, options),
      );
      setRefresh((value) => value + 1);
      notify.success(t('receivedToast'));
    } catch (error) {
      actionFailed(error, t('actionFailed'));
    }
  };
  const acceptForCustomer = async (quotation: InternalQuotationDto) => {
    setAccepting(null);
    try {
      await acceptCustomer([rfqId, request.version, quotation.id], (options) =>
        client.acceptQuotation(rfqId, request.version, { quotationId: quotation.id }, options),
      );
      setRefresh((value) => value + 1);
      notify.success(t('acceptedToast'));
    } catch (error) {
      actionFailed(error, t('acceptFailed'));
    }
  };
  const closeDialog = () => {
    setDialog(null);
    setReason('');
    setReasonMissing(false);
  };
  const cancel = async () => {
    const text = reason.trim();
    if (!text) {
      setReasonMissing(true);
      return;
    }
    closeDialog();
    try {
      // The reason is part of the retained action: a corrected reason is a different cancellation.
      await cancelAcceptedOrder([rfqId, request.version, text], (options) =>
        client.cancelOrder(rfqId, request.version, { reason: text }, options),
      );
      setRefresh((value) => value + 1);
      notify.success(t('cancelledToast'));
    } catch (error) {
      actionFailed(error, t('actionFailed'));
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2">{request.design}</h1>
      <dl className="flex flex-wrap gap-6 text-small">
        <div>
          <dt>{t('status')}</dt>
          <dd>
            <Badge>{rfq(`status.${request.status}`)}</Badge>
          </dd>
        </div>
        <div>
          <dt>{t('quantity')}</dt>
          <dd>
            {format.number(request.quantity)} {request.unit}
          </dd>
        </div>
        <div>
          <dt>{t('biddingCloses')}</dt>
          <dd>{format.dateTime(new Date(request.biddingClosesAt), 'long')}</dd>
        </div>
        <div>
          <dt>{t('requiredBy')}</dt>
          <dd>{format.dateTime(new Date(request.requiredBy), 'long')}</dd>
        </div>
      </dl>
      {request.onBehalfOf ? (
        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="clay">{t('onBehalfBadge')}</Badge>
            <p className="text-small text-ash">{t('onBehalfLead')}</p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-small">
            <div>
              <dt className="text-ash">{t('customerName')}</dt>
              <dd>{request.onBehalfOf.name}</dd>
            </div>
            <div>
              <dt className="text-ash">{t('customerPhone')}</dt>
              <dd>{request.onBehalfOf.phone}</dd>
            </div>
            {request.onBehalfOf.email ? (
              <div>
                <dt className="text-ash">{t('customerEmail')}</dt>
                <dd>{request.onBehalfOf.email}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      ) : null}
      {state.noticeCount > 0 ? (
        <p role="status">{t('notice', { count: state.noticeCount })}</p>
      ) : null}
      {closed ? <p>{t('closed')}</p> : null}
      {bidding ? (
        <AllocationBoard
          key={request.version}
          rfqId={rfqId}
          rfqCode={rfqId}
          requestVersion={request.version}
          quantity={request.quantity}
          unit={request.unit}
          biddingClosesAt={request.biddingClosesAt}
          requiredBy={request.requiredBy}
          contributions={activeOffers.map((offer) => ({
            householdId: offer.householdId,
            name: offer.householdName,
            tint: 'var(--color-clay)',
            maxQuantity: offer.maxQuantity,
            capacity: offer.householdCapacity ?? null,
            unitPriceVnd: offer.unitPriceVnd,
            completionDate: offer.completionDate,
            contributionVersion: offer.version,
          }))}
          {...(draft
            ? {
                initialQuantities: activeOffers.map(
                  (offer) => draft.quantities.get(offer.householdId) ?? 0,
                ),
                initialAdditionalCharge: draft.additionalChargeVnd,
                initialDeliveryTerms: draft.deliveryTerms,
                initialError: t('stale'),
              }
            : {})}
          disabled={closed}
          onSubmit={submit}
        />
      ) : null}
      {state.customer && bidding ? (
        <section aria-labelledby="customer-quotations-title" className="flex flex-col gap-3">
          <h2 id="customer-quotations-title" className="text-h3">
            {t('quotationsTitle')}
          </h2>
          {state.customer.quotations.filter((q) => q.status === 'SUBMITTED').length === 0 ? (
            <p className="text-ash">{t('noQuotations')}</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="customer-quotations">
              {state.customer.quotations
                .filter((quotation) => quotation.status === 'SUBMITTED')
                .map((quotation) => (
                  <li key={quotation.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="flex flex-col gap-1 text-small">
                        <ul>
                          {quotation.parts.map((part) => (
                            <li key={part.householdId}>
                              {part.householdName}: {format.number(part.quantity)} {request.unit}
                            </li>
                          ))}
                        </ul>
                        <p className="font-medium">
                          {t('quotationTotal', { total: money(quotation.totalVnd) })}
                        </p>
                      </div>
                      <Button onClick={() => setAccepting(quotation)}>{t('accept')}</Button>
                    </Card>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ) : null}
      {state.customer && request.status === 'DELIVERED' ? (
        <HouseholdRatings
          client={client}
          requestId={request.id}
          shares={state.customer.allocations}
          ratings={request.ratings ?? []}
          onSaved={() => setRefresh((value) => value + 1)}
        />
      ) : null}
      {request.status === 'ACCEPTED' ? (
        <div className="flex gap-2">
          <Button onClick={() => setDialog('start')}>{t('startProduction')}</Button>
          <Button variant="secondary" onClick={() => setDialog('cancel')}>
            {t('cancelOrder')}
          </Button>
        </div>
      ) : null}
      {request.status === 'IN_PRODUCTION' ? (
        <div className="flex gap-2">
          <Button onClick={() => setDialog('receive')}>{t('receive')}</Button>
          <Button variant="secondary" onClick={() => setDialog('cancel')}>
            {t('cancelOrder')}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={accepting !== null}
        tone="seal"
        title={t('acceptTitle')}
        confirmLabel={t('accept')}
        cancelLabel={t('back')}
        onClose={() => setAccepting(null)}
        onConfirm={() => {
          if (accepting) void acceptForCustomer(accepting);
        }}
      >
        {accepting ? (
          <p className="text-ash">
            {t('acceptText', {
              quantity: format.number(request.quantity),
              unit: request.unit,
              total: money(accepting.totalVnd),
            })}
          </p>
        ) : null}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'start'}
        title={t('startTitle')}
        confirmLabel={t('startProduction')}
        cancelLabel={t('back')}
        onClose={closeDialog}
        onConfirm={() => {
          closeDialog();
          void startProduction();
        }}
      >
        <p className="text-ash">{t('startText')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'receive'}
        title={t('receiveTitle')}
        confirmLabel={t('receive')}
        cancelLabel={t('back')}
        onClose={closeDialog}
        onConfirm={() => {
          closeDialog();
          void receive();
        }}
      >
        <p className="text-ash">{t('receiveText')}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'cancel'}
        tone="seal"
        title={t('cancelOrder')}
        confirmLabel={t('cancelOrder')}
        cancelLabel={t('back')}
        onClose={closeDialog}
        onConfirm={() => void cancel()}
      >
        <label className="flex flex-col gap-2 text-small">
          <span className="text-ash">{t('cancelReason')}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-input border border-ink/20 bg-paper p-3 text-body"
          />
        </label>
        {reasonMissing ? (
          <p role="alert" className="text-small text-seal">
            {t('reasonRequired')}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
