'use client';

import { ApiError, type PaymentClient } from '@vcraft/api-client';
import type { PaymentDto } from '@vcraft/contracts';
import { buttonVariants, Card, cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { usePaymentClient } from '@/lib/api/use-payment-client';
import {
  isDemo,
  isWallet,
  PaymentCheckout,
  PaymentLiveLine,
  PaymentStatusBadge,
  PaymentSummary,
  usePaymentPoll,
} from './payment-parts';

/** After this long still pending, tell the buyer they can leave: the server keeps reconciling. */
export const SLOW_PENDING_MS = 20_000;

/**
 * Where a buyer lands after a wallet's page (`/thanh-toan/{ref}`) and from the order's payment list. It shows the
 * payment and keeps asking the server until it is final: the browser return alone never means paid.
 */
export function PaymentStatusPage({
  reference,
  client: provided,
}: {
  reference: string;
  client?: PaymentClient;
}) {
  const t = useTranslations('payments');
  const { client, loading } = usePaymentClient(provided);
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'signed-out'>('loading');

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setPayment(await client.getPayment(reference));
      setState('ready');
    } catch (error) {
      setState(error instanceof ApiError && error.status === 401 ? 'signed-out' : 'error');
    }
  }, [client, reference]);

  useEffect(() => {
    if (loading) return;
    if (!client) {
      setState('signed-out');
      return;
    }
    void load();
  }, [client, load, loading]);

  usePaymentPoll(client, payment, setPayment);

  const waitingOnWallet = payment?.status === 'PENDING' && isWallet(payment) && !isDemo(payment);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waitingOnWallet) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_PENDING_MS);
    return () => window.clearTimeout(timer);
  }, [waitingOnWallet]);

  return (
    <article className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter pt-8 pb-section">
      <h1 className="text-h1">{t('result.title')}</h1>
      {state === 'loading' ? <ListSkeleton label={t('loading')} className="" rows={2} /> : null}
      {state === 'signed-out' ? <p>{t('signIn')}</p> : null}
      {state === 'error' ? (
        <ErrorState message={t('loadFailed')} onRetry={() => void load()} />
      ) : null}
      {state === 'ready' && payment ? (
        <Card
          className={cn(
            'flex flex-col gap-5 p-5 md:p-6',
            payment.status === 'PAID' && 'ring-2 ring-celadon/50',
          )}
          data-testid="payment-result"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {payment.status === 'PAID' ? <PaidMark /> : null}
            <h2 className="text-h3">{t(`result.heading.${payment.status}`)}</h2>
            <PaymentStatusBadge status={payment.status} />
          </div>
          <PaymentLiveLine payment={payment} />
          <PaymentSummary payment={payment} />
          {waitingOnWallet ? (
            <div className="flex flex-col gap-2 text-small text-ash">
              <p>{t('result.pendingNote')}</p>
              {slow ? <p>{t('result.slowHint')}</p> : null}
            </div>
          ) : null}
          {payment.status === 'FAILED' ||
          payment.status === 'EXPIRED' ||
          payment.status === 'CANCELLED' ? (
            <div className="flex flex-col gap-2 text-small text-ash">
              <p>{t('result.noMoney')}</p>
              <p>{t(isWallet(payment) ? 'result.contactWallet' : 'result.contactBank')}</p>
            </div>
          ) : null}
          <PaymentCheckout payment={payment} />
          <Link
            href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: payment.orderId } }}
            className={cn(
              buttonVariants({
                variant: payment.status === 'PAID' || retryable(payment) ? 'primary' : 'secondary',
              }),
              'self-start',
            )}
          >
            {retryable(payment) ? t('result.another') : t('result.back')}
          </Link>
        </Card>
      ) : null}
    </article>
  );
}

/** A payment that ended without money: the buyer picks a payment method again on the order page. */
const retryable = (payment: PaymentDto) =>
  payment.status === 'FAILED' || payment.status === 'EXPIRED' || payment.status === 'CANCELLED';

function PaidMark() {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-celadon/20 text-celadon"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
