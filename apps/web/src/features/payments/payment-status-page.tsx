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
import { useMoney } from '@/lib/use-money';
import {
  PaymentCheckout,
  PaymentLiveLine,
  PaymentStatusBadge,
  usePaymentPoll,
} from './payment-parts';

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
  const money = useMoney();
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

  return (
    <article className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter pt-8 pb-section">
      <h1 className="text-h1">{t('result.title')}</h1>
      {state === 'loading' ? <ListSkeleton label={t('loading')} className="" rows={2} /> : null}
      {state === 'signed-out' ? <p>{t('signIn')}</p> : null}
      {state === 'error' ? (
        <ErrorState message={t('loadFailed')} onRetry={() => void load()} />
      ) : null}
      {state === 'ready' && payment ? (
        <Card className="flex flex-col gap-5 p-5 md:p-6" data-testid="payment-result">
          <div className="flex flex-wrap items-center gap-3">
            <PaymentStatusBadge status={payment.status} />
            <span className="font-medium">
              {t(`kind.${payment.kind}`)} · {money(payment.amountVnd)}
            </span>
            <span className="text-small text-ash">{t(`method.${payment.method}`)}</span>
          </div>
          <PaymentLiveLine payment={payment} />
          <PaymentCheckout payment={payment} />
          <p className="text-small text-ash">{payment.referenceCode}</p>
          <Link
            href={{ pathname: '/yeu-cau-bao-gia/[code]', params: { code: payment.orderId } }}
            className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}
          >
            {t('result.back')}
          </Link>
        </Card>
      ) : null}
    </article>
  );
}
