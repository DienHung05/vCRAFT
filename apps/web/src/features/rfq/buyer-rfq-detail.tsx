'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto, BuyerQuotationDto, RfqResponse } from '@vcraft/contracts';
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  Crackle,
  cn,
  SealStamp,
  Stepper,
  stampShakeClass,
} from '@vcraft/ui';
import { AnimatePresence } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useLiveEvents } from '@/lib/api/live-events';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { notify } from '@/lib/notify';
import { useMoney } from '@/lib/use-money';
import { BidRow, CountUpMoney } from './bid-motion';
import { DeadlineCountdown } from './deadline-countdown';
import { buyerEvents, rfqStepperModel } from './rfq-flow';
import { RfqForm } from './rfq-form';

const POLL_MS = 10_000;

interface Loaded {
  request: RfqResponse;
  quotations: BuyerQuotationDto[];
  allocations: AllocationDto[];
  withdrawnNotice: boolean;
}

type State =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'error' }
  | ({ kind: 'ready' } & Loaded);

/**
 * Buyer journey on one request (FR-RFQ-07, 08, 09, 12, FR-ORD-08): status stepper, quotation
 * comparison, accept, cancel with a reason, confirm receipt. Actions come from the same state
 * machine the API enforces, so only those valid for the current state appear.
 */
export function BuyerRfqDetail({
  rfqId,
  client: provided,
}: {
  rfqId: string;
  client?: QuotationClient;
}) {
  const t = useTranslations('rfq.live');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <DetailLoading label={t('loading')} />;
  if (!client) return <p className="px-gutter pt-8">{t('signIn')}</p>;
  return <Detail key={rfqId} rfqId={rfqId} client={client} />;
}

function DetailLoading({ label }: { label: string }) {
  return (
    <article className="mx-auto flex max-w-editorial flex-col gap-8 px-gutter pt-8 pb-section">
      <ListSkeleton label={label} className="" rows={2} withHeader />
    </article>
  );
}

function Detail({ rfqId, client }: { rfqId: string; client: QuotationClient }) {
  const live = useTranslations('rfq.live');
  const t = useTranslations('rfq.detail');
  const rfq = useTranslations('rfq');
  const common = useTranslations('common');
  const bids = useTranslations('rfq.bids');
  const order = useTranslations('order');
  const categories = useTranslations('catalog.categories');
  const format = useFormatter();
  const money = useMoney();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [dialog, setDialog] = useState<
    | { kind: 'accept'; quotation: BuyerQuotationDto }
    | { kind: 'cancel' }
    | { kind: 'receive' }
    | null
  >(null);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // BRAND §6.3 #2: the offer the buyer just accepted gets the seal pressed onto it once.
  const [stampedId, setStampedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const request = await client.getRequest(rfqId);
      if (request.status === 'DRAFT') {
        setState({
          kind: 'ready',
          request,
          quotations: [],
          allocations: [],
          withdrawnNotice: false,
        });
        return;
      }
      const [quotations, allocations, notices] = await Promise.all([
        client.listBuyerQuotations(rfqId),
        // The API has no allocations to return before a quotation is accepted.
        client.listAllocations(rfqId).catch(() => [] as AllocationDto[]),
        client.listNotices(),
      ]);
      setState({
        kind: 'ready',
        request,
        quotations,
        allocations,
        withdrawnNotice: notices.some(
          (notice) => notice.requestId === rfqId && notice.kind === 'QUOTATION_WITHDRAWN',
        ),
      });
    } catch (error) {
      setState({
        kind:
          error instanceof QuotationApiError && error.status === 401 ? 'unauthenticated' : 'error',
      });
    }
  }, [client, rfqId]);

  const isDraft = state.kind === 'ready' && state.request.status === 'DRAFT';

  useEffect(() => {
    void load();
  }, [load]);

  // A new offer or allocation notice for this buyer: refetch at once instead of waiting for the poll (GH#93).
  useLiveEvents((event) => {
    if (event.type === 'activity' && !isDraft && !document.hidden) void load();
  });

  // A draft is being edited, so it is not polled: a refresh would reset the form's version.
  useEffect(() => {
    if (isDraft) return;
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [isDraft, load]);

  const shell = (children: React.ReactNode, title?: string) => (
    <article className="mx-auto flex max-w-editorial flex-col gap-8 px-gutter pt-8 pb-section">
      <Breadcrumbs
        items={[
          { label: common('home'), href: '/' },
          { label: rfq('allRequests'), href: '/yeu-cau-bao-gia' },
          { label: title ?? rfqId.slice(0, 8) },
        ]}
      />
      {children}
    </article>
  );

  if (state.kind === 'loading')
    return shell(<ListSkeleton label={live('loading')} className="" rows={2} withHeader />);
  if (state.kind === 'unauthenticated') return shell(<p>{live('signIn')}</p>);
  if (state.kind === 'error')
    return shell(<ErrorState message={live('loadFailed')} onRetry={() => void load()} />);

  const { request, quotations, allocations, withdrawnNotice } = state;
  const events = buyerEvents(request.status);
  const canAccept = events.includes('ACCEPT_BID');
  const canCancel = events.includes('CANCEL');
  const canReceive =
    events.includes('CONFIRM_DELIVERY') &&
    allocations.length > 0 &&
    allocations.every((allocation) => allocation.status === 'DONE');
  const model = rfqStepperModel(request.status, quotations.length > 0);
  const day = (iso: string) => format.dateTime(new Date(iso), 'long');
  const open = quotations.filter((quotation) => quotation.status === 'SUBMITTED');
  const lowest = open.length > 1 ? Math.min(...open.map((quotation) => quotation.totalVnd)) : null;

  const closeDialog = () => {
    setDialog(null);
    setReason('');
    setReasonMissing(false);
    setActionError(null);
  };

  const run = async (
    action: () => Promise<unknown>,
    failure: string,
    success: string,
    stamp?: string,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      closeDialog();
      await load();
      if (stamp) setStampedId(stamp);
      notify.success(success);
    } catch (error) {
      const stale = error instanceof QuotationApiError && error.code === 'STALE_VERSION';
      setActionError(stale ? t('stale') : failure);
      if (stale) await load();
    } finally {
      setBusy(false);
    }
  };

  // A draft was never sent, so it cancels without a reason (FR-RFQ-09, GH#244).
  const reasonRequired = request.status !== 'DRAFT';
  const confirmCancel = () => {
    const text = reason.trim();
    if (!text && reasonRequired) {
      setReasonMissing(true);
      return;
    }
    void run(
      () => client.cancelOrder(rfqId, request.version, text ? { reason: text } : {}),
      t('cancelFailed'),
      t('cancelledToast'),
    );
  };

  return shell(
    <>
      <header className="flex flex-col gap-2">
        {request.category ? (
          <p className="text-small text-ash">{categories(request.category)}</p>
        ) : null}
        <h1 className="text-h1 break-words">{request.title}</h1>
      </header>

      <Card className="p-5 md:p-6">
        <Stepper
          label={rfq('stepperLabel')}
          current={model.current}
          state={model.halted ? 'halted' : 'active'}
          steps={model.steps.map((step) => ({ id: step, label: rfq(`status.${step}`) }))}
        />
      </Card>

      {model.halted ? (
        <section className="relative overflow-hidden rounded-card border border-seal/40 p-6">
          <Crackle className="text-seal" opacity={0.2} />
          <h2 className="relative text-h3 text-seal">
            {rfq(request.status === 'CANCELLED' ? 'halted.cancelledTitle' : 'halted.expiredTitle')}
          </h2>
          <p className="relative mt-1 text-ink/85">
            {request.cancelReason
              ? rfq('halted.reason', { reason: request.cancelReason })
              : rfq('halted.text')}
          </p>
        </section>
      ) : null}

      {withdrawnNotice ? (
        <p role="status" className="rounded-card bg-lacquer/10 p-4">
          {live('notice')}
        </p>
      ) : null}

      {request.status === 'DRAFT' ? (
        <RfqForm client={client} draft={request} />
      ) : (
        <>
          <Card className="grid gap-x-10 gap-y-6 p-6 md:grid-cols-2 md:p-8">
            <dl className="contents">
              <Item label={rfq('summary.quantity')}>
                {format.number(request.quantity)} {request.unit}
              </Item>
              {request.budgetMinVnd !== null && request.budgetMaxVnd !== null ? (
                <Item label={rfq('summary.budget')}>
                  {rfq('summary.budgetRange', {
                    min: money(request.budgetMinVnd),
                    max: money(request.budgetMaxVnd),
                  })}
                </Item>
              ) : null}
              <Item label={rfq('summary.biddingCloses')}>
                <time dateTime={request.biddingClosesAt}>{day(request.biddingClosesAt)}</time>
                <span className="block text-small">
                  <DeadlineCountdown until={request.biddingClosesAt} />
                </span>
              </Item>
              <Item label={rfq('summary.requiredBy')}>
                <time dateTime={request.requiredBy}>{day(request.requiredBy)}</time>
              </Item>
              <Item label={t('description')}>
                <span className="break-words whitespace-pre-wrap">{request.design}</span>
              </Item>
              <Item label={rfq('summary.deliverTo')}>{request.destination}</Item>
            </dl>
            {request.coordinationOptIn ? (
              <p className="text-small text-ash md:col-span-2">{t('coordinated')}</p>
            ) : null}
          </Card>

          <section aria-labelledby="quotations-title" className="flex flex-col gap-4">
            <h2 id="quotations-title">{bids('title')}</h2>
            {quotations.length === 0 ? (
              <EmptyState
                illustration="scroll"
                headingLevel="h3"
                title={bids('emptyTitle')}
                description={bids('empty')}
                action={
                  <Link
                    href="/yeu-cau-bao-gia"
                    className={buttonVariants({ variant: 'secondary' })}
                  >
                    {rfq('allRequests')}
                  </Link>
                }
              />
            ) : null}
            <ul className="flex flex-col gap-4" data-testid="quotation-comparison">
              {/* BRAND §6.3 #8: a new offer slides onto the table; offers there on first load stay put. */}
              <AnimatePresence initial={false}>
                {quotations.map((quotation) => {
                  const best = lowest === quotation.totalVnd && quotation.status === 'SUBMITTED';
                  const stamped = stampedId === quotation.id && quotation.status === 'ACCEPTED';
                  return (
                    <BidRow key={quotation.id}>
                      <Card
                        className={cn(
                          'flex flex-col gap-4 p-5 md:p-6',
                          stamped && stampShakeClass(),
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge>{bids(`status.${quotation.status}`)}</Badge>
                          {best ? <Badge tone="clay">{t('best')}</Badge> : null}
                          {stamped ? (
                            <SealStamp size={40} title={t('acceptedToast')} className="ml-auto" />
                          ) : null}
                        </div>
                        <ul className="flex flex-col gap-2">
                          {quotation.parts.map((part) => (
                            <li key={part.householdId} className="flex flex-wrap gap-x-4">
                              <span className="font-medium">{part.householdName}</span>
                              <span>
                                {format.number(part.quantity)} {request.unit}
                              </span>
                              <time dateTime={part.completionDate} className="text-ash">
                                {format.dateTime(new Date(part.completionDate), 'short')}
                              </time>
                            </li>
                          ))}
                        </ul>
                        <dl className="grid grid-cols-[1fr_auto] gap-2">
                          <dt>{live('productionTotal')}</dt>
                          <dd>{money(quotation.productionTotalVnd)}</dd>
                          <dt>{live('additionalCharge')}</dt>
                          <dd>{money(quotation.additionalChargeVnd)}</dd>
                          <dt>{live('total')}</dt>
                          {/* The best cell glows lacquer gold once each time it becomes the best. */}
                          <dd
                            key={best ? 'best' : 'plain'}
                            data-best={best || undefined}
                            className={cn(
                              'font-semibold',
                              best && 'bid-best -mx-1 rounded-input px-1',
                            )}
                          >
                            <CountUpMoney vnd={quotation.totalVnd} format={money} />
                          </dd>
                        </dl>
                        <p className="text-small text-ash">
                          {live(
                            quotation.deliveryTerms === 'INCLUDED'
                              ? 'deliveryIncluded'
                              : 'deliverySeparate',
                          )}
                        </p>
                        {canAccept && quotation.status === 'SUBMITTED' ? (
                          <Button
                            className="self-start"
                            onClick={() => setDialog({ kind: 'accept', quotation })}
                          >
                            {t('accept')}
                          </Button>
                        ) : null}
                      </Card>
                    </BidRow>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>

          {allocations.length > 0 ? (
            <section aria-labelledby="order-title" className="flex flex-col gap-4">
              <h2 id="order-title">{order('title')}</h2>
              <ul className="flex flex-col gap-3">
                {allocations.map((allocation) => (
                  <li key={allocation.id}>
                    <Card className="flex flex-col gap-2 p-4">
                      <Badge className="self-start">
                        {order(`allocation.${allocation.status}`)}
                      </Badge>
                      <p>
                        {format.number(allocation.completedQty)} /{' '}
                        {format.number(allocation.quantity)} {request.unit}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {actionError && !dialog ? (
        <p role="alert" className="text-seal">
          {actionError}
        </p>
      ) : null}

      {canReceive || canCancel ? (
        <div className="flex flex-wrap gap-3">
          {canReceive ? (
            <Button disabled={busy} onClick={() => setDialog({ kind: 'receive' })}>
              {order('receive')}
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="secondary" onClick={() => setDialog({ kind: 'cancel' })}>
              {t('cancel')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={dialog?.kind === 'accept'}
        tone="seal"
        title={t('acceptTitle')}
        confirmLabel={t('accept')}
        cancelLabel={rfq('dialog.back')}
        confirmDisabled={busy}
        onClose={closeDialog}
        onConfirm={() => {
          if (dialog?.kind === 'accept')
            void run(
              () =>
                client.acceptQuotation(rfqId, request.version, {
                  quotationId: dialog.quotation.id,
                }),
              t('acceptFailed'),
              t('acceptedToast'),
              dialog.quotation.id,
            );
        }}
      >
        {dialog?.kind === 'accept' ? (
          <p className="text-ink/85">
            {t('acceptText', {
              quantity: format.number(request.quantity),
              unit: request.unit,
              total: money(dialog.quotation.totalVnd),
            })}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-small text-seal">
            {actionError}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'receive'}
        title={t('receiveTitle')}
        confirmLabel={order('receive')}
        cancelLabel={rfq('dialog.back')}
        confirmDisabled={busy}
        onClose={closeDialog}
        onConfirm={() =>
          void run(
            () => client.confirmReceipt(rfqId, request.version),
            order('stale'),
            t('receivedToast'),
          )
        }
      >
        <p className="text-ash">{t('receiveText')}</p>
        {actionError ? (
          <p role="alert" className="text-small text-seal">
            {actionError}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'cancel'}
        title={t('cancel')}
        confirmLabel={t('cancel')}
        cancelLabel={rfq('dialog.back')}
        confirmDisabled={busy}
        onClose={closeDialog}
        onConfirm={confirmCancel}
      >
        <label className="flex flex-col gap-2 text-small">
          <span className="text-ash">{rfq('dialog.reasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={rfq('dialog.reasonPlaceholder')}
            className="rounded-input border border-ink/20 bg-paper p-3 text-body"
          />
        </label>
        {reasonMissing ? (
          <p role="alert" className="text-small text-seal">
            {t('reasonRequired')}
          </p>
        ) : null}
        {actionError ? (
          <p role="alert" className="text-small text-seal">
            {actionError}
          </p>
        ) : null}
      </ConfirmDialog>
    </>,
    request.title,
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-small text-ash">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
