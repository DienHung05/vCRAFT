'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PaymentStatusBadge, RefundDueBadge } from '@/features/payments/payment-parts';
import { usePaymentClient } from '@/lib/api/use-payment-client';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { useMoney } from '@/lib/use-money';

/**
 * The payments of one order for the village board (ADR-0021 slice 6): deposit and balance, the payments with
 * their state, an offline balance entry, a manual "mark refunded" and, in the sandbox, a simulated transfer.
 * It shows nothing when payment is not in use for this order.
 */
export function AdminOrderPayments({
  orderId,
  client: provided,
}: {
  orderId: string;
  client?: PaymentClient;
}) {
  const { client } = usePaymentClient(provided);
  if (!client) return null;
  return <Panel orderId={orderId} client={client} />;
}

function Panel({ orderId, client }: { orderId: string; client: PaymentClient }) {
  const t = useTranslations('admin.payments.panel');
  const kinds = useTranslations('payments.kind');
  const methods = useTranslations('payments.method');
  const format = useFormatter();
  const money = useMoney();
  const [summary, setSummary] = useState<OrderPaymentsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [refunding, setRefunding] = useState<PaymentDto | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(false);
  const [busy, setBusy] = useState(false);
  const noteInput = useRef<HTMLInputElement>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const noteErrorId = useId();
  const reasonErrorId = useId();
  const [error, setError] = useState<string | null>(null);
  const submitRecord = useIdempotentAction();

  const load = useCallback(async () => {
    try {
      setSummary(await client.orderPayments(orderId));
      setFailed(false);
    } catch (cause) {
      setSummary(null);
      setFailed(!(cause instanceof ApiError && cause.status === 404));
    }
  }, [client, orderId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (failed) return <p className="text-small text-ash">{t('failed')}</p>;
  if (!summary) return null;
  const idle =
    summary.methods.length === 0 && !summary.depositRequired && summary.payments.length === 0;
  if (idle && !summary.simulateAvailable) return null;
  const day = (iso: string) => format.dateTime(new Date(iso), 'short');

  const act = async (work: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      notify.success(success);
      await load();
      return true;
    } catch (cause) {
      const stale = cause instanceof ApiError && cause.code === 'STALE_VERSION';
      setError(stale ? t('stale') : failure);
      if (stale) await load();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const record = async () => {
    if (note.trim().length < 3) {
      setNoteError(true);
      noteInput.current?.focus();
      return;
    }
    setNoteError(false);
    const body = { kind: 'BALANCE' as const, note: note.trim() };
    if (
      await act(
        () =>
          submitRecord({ orderId, body }, (options) =>
            client.recordOfflinePayment(orderId, body, options),
          ),
        t('recorded'),
        t('recordFailed'),
      )
    )
      setNote('');
  };

  const refund = async () => {
    if (!refunding) return;
    if (reason.trim().length < 3) {
      setReasonError(true);
      reasonInput.current?.focus();
      return;
    }
    const target = refunding;
    if (
      await act(
        () => client.refundPayment(target.id, target.version, { reason: reason.trim() }),
        t('refunded'),
        t('refundFailed'),
      )
    ) {
      setRefunding(null);
      setReason('');
      setReasonError(false);
    }
  };

  return (
    <section
      aria-labelledby="admin-payments-title"
      className="flex flex-col gap-4"
      data-testid="admin-order-payments"
    >
      <header className="flex flex-col gap-1">
        <h2 id="admin-payments-title">{t('title')}</h2>
        <p className="text-small text-ash">{t('lead')}</p>
      </header>
      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          <dt>{t('total')}</dt>
          <dd>{money(summary.totalVnd)}</dd>
          <dt>{t('deposit', { percent: summary.depositPercent })}</dt>
          <dd>
            {money(summary.depositAmountVnd)}{' '}
            <span className="text-small text-ash">
              {summary.depositPaidAt
                ? t('paidOn', { date: day(summary.depositPaidAt) })
                : t('notPaid')}
            </span>
          </dd>
          <dt>{t('balance')}</dt>
          <dd>
            {money(summary.balanceAmountVnd)}{' '}
            <span className="text-small text-ash">
              {summary.balancePaidAt
                ? t('paidOn', { date: day(summary.balancePaidAt) })
                : t('notPaid')}
            </span>
          </dd>
        </dl>
        {summary.depositRequired && !summary.depositPaidAt ? (
          <p className="text-small text-ash">{t('depositRequired')}</p>
        ) : null}

        {summary.payments.length === 0 ? (
          <p className="text-ash">{t('none')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {summary.payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-3"
                data-testid="admin-payment-row"
              >
                <PaymentStatusBadge status={payment.status} />
                <RefundDueBadge payment={payment} />
                <span className="font-medium">
                  {kinds(payment.kind)} · {money(payment.amountVnd)}
                </span>
                <span className="text-small text-ash">{methods(payment.method)}</span>
                <span className="font-mono text-small">{payment.referenceCode}</span>
                {payment.note ? <span className="text-small text-ash">{payment.note}</span> : null}
                <span className="ml-auto flex gap-2">
                  {summary.simulateAvailable &&
                  payment.status === 'PENDING' &&
                  payment.method === 'SEPAY_TRANSFER' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(
                          () => client.simulateTransfer(payment.id),
                          t('simulated'),
                          t('simulateFailed'),
                        )
                      }
                    >
                      {t('simulate')}
                    </Button>
                  ) : null}
                  {payment.status === 'PAID' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setRefunding(payment);
                        setReason('');
                        setReasonError(false);
                        setError(null);
                      }}
                    >
                      {t('refund')}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}

        {!summary.balancePaidAt ? (
          <div className="flex flex-col gap-3 border-t border-ink/10 pt-5">
            <h3 className="text-h4">{t('recordTitle')}</h3>
            <p className="text-small text-ash">{t('recordHelp')}</p>
            <label className="flex flex-col gap-2 text-small">
              <span className="text-ash">{t('noteLabel')}</span>
              <input
                ref={noteInput}
                aria-invalid={noteError}
                aria-describedby={noteError ? noteErrorId : undefined}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder={t('notePlaceholder')}
                className="h-11 rounded-input border border-ink/20 bg-paper px-3 text-body"
              />
            </label>
            {noteError ? (
              <p id={noteErrorId} role="alert" className="text-small text-seal">
                {t('noteRequired')}
              </p>
            ) : null}
            <Button
              type="button"
              className="self-start"
              disabled={busy}
              onClick={() => void record()}
            >
              {busy ? t('recording') : t('record')}
            </Button>
          </div>
        ) : null}
        {error && !refunding ? (
          <p role="alert" className="text-seal">
            {error}
          </p>
        ) : null}
      </Card>

      <ConfirmDialog
        open={refunding !== null}
        tone="seal"
        title={t('refundTitle')}
        confirmLabel={t('refundConfirm')}
        cancelLabel={t('back')}
        confirmDisabled={busy}
        onClose={() => setRefunding(null)}
        onConfirm={() => void refund()}
      >
        <p className="text-ash">{t('refundHelp')}</p>
        <label className="mt-3 flex flex-col gap-2 text-small">
          <span className="text-ash">{t('reasonLabel')}</span>
          <textarea
            ref={reasonInput}
            aria-invalid={reasonError}
            aria-describedby={reasonError ? reasonErrorId : undefined}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-input border border-ink/20 bg-paper p-3 text-body"
          />
        </label>
        {reasonError ? (
          <p id={reasonErrorId} role="alert" className="text-small text-seal">
            {t('reasonRequired')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-small text-seal">
            {error}
          </p>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
