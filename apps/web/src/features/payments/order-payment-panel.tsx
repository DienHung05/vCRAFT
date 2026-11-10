'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { usePaymentClient } from '@/lib/api/use-payment-client';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { useMoney } from '@/lib/use-money';
import {
  PaymentCheckout,
  PaymentLiveLine,
  PaymentStatusBadge,
  usePaymentPoll,
} from './payment-parts';

type Method = OrderPaymentsDto['methods'][number];

/**
 * The buyer's payment panel on an accepted order (ADR-0021): what is owed, the way to pay a deposit or the
 * balance (bank transfer with a QR, or a wallet when the sandbox flag is on), and the live status of the
 * payment in progress. It shows nothing when this deployment has online payment switched off.
 */
export function OrderPaymentPanel({
  orderId,
  orderStatus,
  client: provided,
}: {
  orderId: string;
  orderStatus: string;
  client?: PaymentClient;
}) {
  const { client } = usePaymentClient(provided);
  if (!client) return null;
  return <Panel orderId={orderId} orderStatus={orderStatus} client={client} />;
}

function Panel({
  orderId,
  orderStatus,
  client,
}: {
  orderId: string;
  orderStatus: string;
  client: PaymentClient;
}) {
  const t = useTranslations('payments');
  const money = useMoney();
  const format = useFormatter();
  const [summary, setSummary] = useState<OrderPaymentsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitStart = useIdempotentAction();

  const load = useCallback(async () => {
    try {
      setSummary(await client.orderPayments(orderId));
      setFailed(false);
    } catch (cause) {
      // Not an order of this buyer, or not accepted yet: nothing to show.
      setFailed(!(cause instanceof ApiError && (cause.status === 404 || cause.status === 401)));
      setSummary(null);
    }
  }, [client, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = summary?.payments.find((payment) => payment.status === 'PENDING') ?? null;
  usePaymentPoll(client, pending, () => void load());

  if (failed) return <p className="text-small text-ash">{t('loadFailed')}</p>;
  if (!summary) return null;
  const nothingToOffer =
    summary.methods.length === 0 && !summary.depositRequired && summary.payments.length === 0;
  if (nothingToOffer) return null;

  const kind: PaymentDto['kind'] | null = summary.depositPaidAt
    ? summary.balancePaidAt
      ? null
      : 'BALANCE'
    : orderStatus === 'ACCEPTED'
      ? 'DEPOSIT'
      : null;
  const amount = kind === 'DEPOSIT' ? summary.depositAmountVnd : summary.balanceAmountVnd;
  const chosen = method ?? summary.methods[0] ?? null;
  const day = (iso: string) => format.dateTime(new Date(iso), 'short');

  const start = async () => {
    if (!kind || !chosen) return;
    setBusy(true);
    setError(null);
    const body = { kind, method: chosen };
    try {
      await submitStart({ orderId, body }, (options) =>
        client.createPayment(orderId, body, options),
      );
      await load();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : 'default';
      const known = [
        'PAYMENT_METHOD_UNAVAILABLE',
        'PAYMENT_ORDER_NOT_PAYABLE',
        'PAYMENT_ALREADY_PAID',
        'PAYMENT_DEPOSIT_REQUIRED',
        'SERVICE_UNAVAILABLE',
      ].includes(code);
      setError(t(`errors.${known ? code : 'default'}` as 'errors.default'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (payment: PaymentDto) => {
    setBusy(true);
    try {
      await client.cancelPayment(payment.referenceCode);
      await load();
    } catch {
      notify.error(t('errors.default'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="payment-title"
      className="flex flex-col gap-4"
      data-testid="payment-panel"
    >
      <h2 id="payment-title">{t('summary.title')}</h2>
      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          <dt>{t('summary.total')}</dt>
          <dd>{money(summary.totalVnd)}</dd>
          <dt>{t('summary.deposit', { percent: summary.depositPercent })}</dt>
          <dd>
            {money(summary.depositAmountVnd)}{' '}
            <span className="text-small text-ash">
              {summary.depositPaidAt
                ? t('summary.paidOn', { date: day(summary.depositPaidAt) })
                : t('summary.notPaid')}
            </span>
          </dd>
          <dt>{t('summary.balance')}</dt>
          <dd>
            {money(summary.balanceAmountVnd)}{' '}
            <span className="text-small text-ash">
              {summary.balancePaidAt
                ? t('summary.paidOn', { date: day(summary.balancePaidAt) })
                : t('summary.notPaid')}
            </span>
          </dd>
        </dl>
        {summary.depositRequired && !summary.depositPaidAt ? (
          <p className="text-small text-ash">{t('summary.depositRequired')}</p>
        ) : null}

        {pending ? (
          <div className="flex flex-col gap-4 border-t border-ink/10 pt-5">
            <div className="flex flex-wrap items-center gap-3">
              <PaymentStatusBadge status={pending.status} />
              <span className="font-medium">
                {t(`kind.${pending.kind}`)} · {money(pending.amountVnd)}
              </span>
              <span className="text-small text-ash">{t(`method.${pending.method}`)}</span>
            </div>
            <PaymentLiveLine payment={pending} />
            <PaymentCheckout payment={pending} />
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              disabled={busy}
              onClick={() => void cancel(pending)}
            >
              {busy ? t('cancelling') : t('cancel')}
            </Button>
          </div>
        ) : kind ? (
          <div className="flex flex-col gap-4 border-t border-ink/10 pt-5">
            {summary.methods.length === 0 ? (
              <p className="text-ash">{t('pay.noMethods')}</p>
            ) : (
              <fieldset className="flex flex-col gap-3">
                <legend className="font-medium">
                  {t(kind === 'DEPOSIT' ? 'pay.deposit' : 'pay.balance')} · {money(amount)}
                </legend>
                <p className="text-small text-ash">{t('pay.choose')}</p>
                {summary.methods.map((option) => (
                  <label key={option} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment-method"
                      checked={chosen === option}
                      onChange={() => setMethod(option)}
                    />
                    {t(`method.${option}`)}
                  </label>
                ))}
                {summary.methods.some((option) => option !== 'SEPAY_TRANSFER') ? (
                  <p className="text-small text-ash">{t('summary.sandbox')}</p>
                ) : null}
                <Button
                  type="button"
                  className="self-start"
                  disabled={busy || !chosen}
                  onClick={() => void start()}
                >
                  {busy ? t('pay.starting') : t('pay.start')}
                </Button>
              </fieldset>
            )}
            {error ? (
              <p role="alert" className="text-seal">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      {summary.payments.some((payment) => payment.status !== 'PENDING') ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-h4">{t('history')}</h3>
          <ul className="flex flex-col gap-2">
            {summary.payments
              .filter((payment) => payment.status !== 'PENDING')
              .map((payment) => (
                <li key={payment.id} className="flex flex-wrap items-center gap-3">
                  <PaymentStatusBadge status={payment.status} />
                  <span>
                    {t(`kind.${payment.kind}`)} · {money(payment.amountVnd)} ·{' '}
                    {t(`method.${payment.method}`)}
                  </span>
                  <Link
                    href={{ pathname: '/thanh-toan/[ref]', params: { ref: payment.referenceCode } }}
                    className="text-small underline"
                  >
                    {payment.referenceCode}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
