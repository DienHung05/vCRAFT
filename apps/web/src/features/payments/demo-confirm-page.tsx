'use client';

import { ApiError, createDemoPaymentClient, type DemoPaymentClient } from '@vcraft/api-client';
import type { DemoPaymentViewDto } from '@vcraft/contracts';
import { Badge, Button, buttonVariants, Card, cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useMoney } from '@/lib/use-money';

type Outcome = 'PAID' | 'FAILED';
type Phase =
  | { name: 'loading' }
  | { name: 'invalid' }
  | { name: 'error' }
  | { name: 'ready'; payment: DemoPaymentViewDto };

/**
 * The page a demo payment's QR opens on the buyer's phone (ADR-0025): public, one card, one decision. Whoever holds
 * the link (it carries the per-payment secret) can confirm or cancel the rehearsal; no money moves.
 */
export function DemoConfirmPage({
  reference,
  token,
  client: provided,
}: {
  reference: string;
  token: string | null;
  client?: DemoPaymentClient;
}) {
  const t = useTranslations('payments.demoConfirm');
  const demo = useTranslations('payments.demo');
  const method = useTranslations('payments.method');
  const kind = useTranslations('payments.kind');
  const status = useTranslations('payments.status');
  const money = useMoney();
  const client = useMemo(() => provided ?? createDemoPaymentClient(), [provided]);
  const [phase, setPhase] = useState<Phase>(token ? { name: 'loading' } : { name: 'invalid' });
  const [sending, setSending] = useState<Outcome | null>(null);
  const [sendFailed, setSendFailed] = useState(false);
  /** What this visit did, so the page can say "confirmed" or "cancelled" even after the status reads back. */
  const [acted, setActed] = useState<Outcome | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setPhase({ name: 'loading' });
    try {
      setPhase({ name: 'ready', payment: await client.view(reference, token) });
    } catch (cause) {
      setPhase(
        cause instanceof ApiError && cause.status === 404 ? { name: 'invalid' } : { name: 'error' },
      );
    }
  }, [client, reference, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (outcome: Outcome) => {
    if (!token) return;
    setSending(outcome);
    setSendFailed(false);
    try {
      const payment = await client.confirm(reference, { token, outcome });
      setActed(outcome);
      setPhase({ name: 'ready', payment });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) setPhase({ name: 'invalid' });
      else setSendFailed(true);
    } finally {
      setSending(null);
    }
  };

  const payment = phase.name === 'ready' ? phase.payment : null;
  const resultLink = (
    <Link
      href={{ pathname: '/thanh-toan/[ref]', params: { ref: reference } }}
      className={cn(buttonVariants({ variant: 'secondary' }), 'w-full sm:w-auto')}
    >
      {t('viewResult')}
    </Link>
  );

  return (
    <article className="mx-auto flex w-full max-w-md flex-col gap-5 px-gutter pt-8 pb-section">
      <h1 className="text-h2 text-glaze">{t('title')}</h1>
      <Card className="flex flex-col gap-5 p-5" data-testid="demo-confirm-card">
        <p>
          <Badge tone="outline" data-testid="demo-notice">
            {demo('notice')}
          </Badge>
        </p>

        {phase.name === 'loading' ? (
          <div role="status" aria-label={t('loading')} className="flex flex-col gap-3">
            <div className="h-9 w-2/3 rounded-input bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-5 w-full rounded-input bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-5 w-4/5 rounded-input bg-ink/10 motion-safe:animate-pulse" />
            <div className="h-11 w-full rounded-input bg-ink/10 motion-safe:animate-pulse" />
          </div>
        ) : null}

        {phase.name === 'invalid' ? (
          <p role="alert" data-testid="demo-invalid">
            {t('invalid')}
          </p>
        ) : null}

        {phase.name === 'error' ? (
          <div role="alert" className="flex flex-col items-start gap-3">
            <p>{t('error')}</p>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {payment ? (
          <>
            <p className="font-semibold text-h2 tabular-nums" data-testid="demo-amount">
              {money(payment.amountVnd)}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-small text-ash">{t('method')}</dt>
              <dd>{method(payment.method)}</dd>
              <dt className="text-small text-ash">{t('kind')}</dt>
              <dd>{kind(payment.kind)}</dd>
              <dt className="text-small text-ash">{t('reference')}</dt>
              <dd className="break-all font-mono">{payment.referenceCode}</dd>
            </dl>

            {payment.status === 'PENDING' ? (
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  className="w-full"
                  disabled={sending !== null}
                  onClick={() => void send('PAID')}
                >
                  {sending === 'PAID' ? t('sending') : t('confirm')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={sending !== null}
                  onClick={() => void send('FAILED')}
                >
                  {sending === 'FAILED' ? t('sending') : t('decline')}
                </Button>
                {sendFailed ? (
                  <p role="alert" className="text-seal">
                    {t('error')}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p role="status" className="flex items-start gap-3 font-medium">
                  {payment.status === 'PAID' ? <Check /> : null}
                  <span data-testid="demo-result">
                    {payment.status === 'PAID'
                      ? acted === 'PAID'
                        ? t('confirmed')
                        : t('alreadyPaid')
                      : payment.status === 'FAILED' && acted === 'FAILED'
                        ? t('declined')
                        : t('ended', { status: status(payment.status) })}
                  </span>
                </p>
                {payment.status === 'PAID' ? resultLink : null}
              </div>
            )}
          </>
        ) : null}
      </Card>
    </article>
  );
}

function Check() {
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-celadon/20 text-celadon"
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
