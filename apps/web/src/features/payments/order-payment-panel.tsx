'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { OrderPaymentsDto, PaymentDto } from '@vcraft/contracts';
import { Button, Card, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { usePaymentClient } from '@/lib/api/use-payment-client';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { useMoney } from '@/lib/use-money';
import {
  isDemo,
  PaymentCheckout,
  PaymentLiveLine,
  PaymentStatusBadge,
  RefundDueBadge,
  usePaymentPoll,
} from './payment-parts';

type Method = OrderPaymentsDto['methods'][number];
type MethodOption = OrderPaymentsDto['methodOptions'][number];

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
  const [busy, setBusy] = useState(false);
  /** Said once through the live region (and as a toast) when a demo payment the panel was polling turns paid. */
  const [announcement, setAnnouncement] = useState('');

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
  usePaymentPoll(client, pending, (fresh) => {
    if (fresh.status === 'PAID' && isDemo(fresh)) {
      const message = t('demo.paidToast');
      notify.success(message);
      setAnnouncement(message);
    }
    void load();
  });

  if (failed) return <p className="text-small text-ash">{t('loadFailed')}</p>;
  if (!summary) return null;
  const nothingToOffer =
    summary.methods.length === 0 && !summary.depositRequired && summary.payments.length === 0;
  if (nothingToOffer) return null;

  // The deposit is next while it is unpaid and still payable: on an accepted order, or later when this
  // deployment does not require it (the server accepts a late deposit then).
  const depositPayable =
    orderStatus === 'ACCEPTED' ||
    (!summary.depositRequired && (orderStatus === 'IN_PRODUCTION' || orderStatus === 'DELIVERED'));
  const kind: PaymentDto['kind'] | null = summary.depositPaidAt
    ? summary.balancePaidAt
      ? null
      : 'BALANCE'
    : depositPayable
      ? 'DEPOSIT'
      : null;
  const amount = kind === 'DEPOSIT' ? summary.depositAmountVnd : summary.balanceAmountVnd;
  // Before the deposit is paid, show the balance that remains after it (the server prices a balance at the
  // whole total only when production started without any deposit).
  const balanceShown =
    kind === 'DEPOSIT' ? summary.totalVnd - summary.depositAmountVnd : summary.balanceAmountVnd;
  const day = (iso: string) => format.dateTime(new Date(iso), 'short');

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
      <p role="status" className="sr-only" data-testid="payment-announcement">
        {announcement}
      </p>
      <Card className="flex flex-col gap-5 p-5 md:p-6">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2">
          <dt>{t('summary.total')}</dt>
          <dd>{money(summary.totalVnd)}</dd>
          <dt>{t('summary.deposit', { percent: summary.depositPercent })}</dt>
          <dd className="text-right sm:text-left">
            {money(summary.depositAmountVnd)}{' '}
            <span className="block text-small text-ash sm:inline">
              {summary.depositPaidAt
                ? t('summary.paidOn', { date: day(summary.depositPaidAt) })
                : t('summary.notPaid')}
            </span>
          </dd>
          <dt>{t('summary.balance')}</dt>
          <dd className="text-right sm:text-left">
            {money(balanceShown)}{' '}
            <span className="block text-small text-ash sm:inline">
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
              <MethodPicker
                key={kind}
                orderId={orderId}
                kind={kind}
                amount={amount}
                options={optionsOf(summary)}
                demo={summary.demo}
                client={client}
                onStarted={load}
              />
            )}
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
                  <RefundDueBadge payment={payment} />
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

/** The server's per-method options; an older answer without them still lists the methods, with no limits. */
function optionsOf(summary: OrderPaymentsDto): MethodOption[] {
  const detailed = summary.methodOptions as MethodOption[] | undefined;
  if (detailed && detailed.length > 0) return detailed;
  return summary.methods.map((method) => ({
    method,
    sandbox: summary.demo === true,
    minAmountVnd: 0,
    maxAmountVnd: null,
  }));
}

/** Why a method cannot take this amount, or `null` when it can. */
function limitOf(option: MethodOption, amount: number): 'underMin' | 'overMax' | null {
  if (amount < option.minAmountVnd) return 'underMin';
  if (option.maxAmountVnd !== null && amount > option.maxAmountVnd) return 'overMax';
  return null;
}

const KNOWN_ERRORS = [
  'PAYMENT_METHOD_UNAVAILABLE',
  'PAYMENT_AMOUNT_OUT_OF_RANGE',
  'PAYMENT_ORDER_NOT_PAYABLE',
  'PAYMENT_ALREADY_PAID',
  'PAYMENT_DEPOSIT_REQUIRED',
  'SERVICE_UNAVAILABLE',
];

/**
 * Choice of the payment method as option cards (a radio group), then the button that starts the payment. A wallet
 * payment goes straight to the provider's page; a bank transfer shows its details in the panel.
 */
function MethodPicker({
  orderId,
  kind,
  amount,
  options,
  demo,
  client,
  onStarted,
}: {
  orderId: string;
  kind: PaymentDto['kind'];
  amount: number;
  options: MethodOption[];
  /** Demo payment mode: every method is a rehearsal confirmed on a phone (ADR-0025). */
  demo: boolean;
  client: PaymentClient;
  onStarted: () => Promise<void>;
}) {
  const t = useTranslations('payments');
  const money = useMoney();
  const uid = useId();
  const [picked, setPicked] = useState<Method | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState<Method | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitStart = useIdempotentAction();

  // Coming back with the browser's back button can restore this page frozen mid-redirect.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      setBusy(false);
      setLeaving(null);
      void onStarted();
    };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [onStarted]);

  const enabled = options.filter((option) => limitOf(option, amount) === null);
  const chosen = enabled.find((option) => option.method === picked) ?? enabled[0] ?? null;

  const start = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    let navigating = false;
    const body = { kind, method: chosen.method };
    try {
      const payment = await submitStart({ orderId, body }, (options) =>
        client.createPayment(orderId, body, options),
      );
      if (payment.checkout?.type === 'REDIRECT') {
        navigating = true;
        setLeaving(chosen.method);
        window.location.assign(payment.checkout.url);
        return;
      }
      await onStarted();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : 'default';
      setError(t(`errors.${KNOWN_ERRORS.includes(code) ? code : 'default'}` as 'errors.default'));
    } finally {
      if (!navigating) setBusy(false);
    }
  };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="font-medium">
        {t(kind === 'DEPOSIT' ? 'pay.deposit' : 'pay.balance')} · {money(amount)}
      </legend>
      <p className="text-small text-ash">{t('pay.choose')}</p>
      <div className="flex flex-col gap-3">
        {options.map((option) => {
          const limit = limitOf(option, amount);
          const id = `${uid}-${option.method}`;
          const describedBy = [`${id}-hint`, limit ? `${id}-reason` : null]
            .filter(Boolean)
            .join(' ');
          return (
            <label
              key={option.method}
              data-testid={`payment-method-${option.method}`}
              className={cn(
                'group flex min-h-11 w-full items-start gap-3 rounded-card border border-ink/15 bg-surface p-4',
                'has-checked:border-clay has-checked:bg-clay/8 has-checked:ring-1 has-checked:ring-clay',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-glaze',
                'motion-safe:transition-colors motion-safe:duration-(--duration-quick)',
                limit ? 'cursor-not-allowed bg-ink/4' : 'cursor-pointer',
              )}
            >
              <input
                type="radio"
                name={`${uid}-method`}
                className="sr-only"
                checked={chosen?.method === option.method}
                disabled={limit !== null}
                aria-disabled={limit !== null}
                aria-labelledby={`${id}-title`}
                aria-describedby={describedBy}
                onChange={() => setPicked(option.method)}
              />
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-ink/30 text-paper group-has-checked:border-clay group-has-checked:bg-clay"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className="size-3 opacity-0 group-has-checked:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M2.5 6.5l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span id={`${id}-title`} className={cn('font-medium', limit && 'text-ash')}>
                    {t(`method.${option.method}`)}
                  </span>
                </span>
                <span id={`${id}-hint`} className="text-small text-ash">
                  {t(`methodHint.${option.method}`)}
                </span>
                {limit ? (
                  <span id={`${id}-reason`} className="text-small font-medium text-ink">
                    {limit === 'overMax'
                      ? t('pay.overMax', { max: money(option.maxAmountVnd ?? 0) })
                      : t('pay.underMin', { min: money(option.minAmountVnd) })}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      {chosen ? (
        <Button type="button" className="self-start" disabled={busy} onClick={() => void start()}>
          {busy && !leaving
            ? t('pay.starting')
            : demo
              ? t('pay.startDemo')
              : t(`pay.startBy.${chosen.method}`)}
        </Button>
      ) : (
        <p className="text-ash">{t('pay.noneFit')}</p>
      )}
      {leaving ? (
        <p role="status" className="flex items-start gap-2.5 text-ash">
          <span
            aria-hidden="true"
            className="mt-[9px] size-2 shrink-0 rounded-full bg-clay motion-safe:animate-pulse"
          />
          {t('pay.redirecting', { method: t(`methodShort.${leaving}`) })}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-seal">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
