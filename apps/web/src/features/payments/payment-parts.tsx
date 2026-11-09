'use client';

import type { PaymentClient } from '@vcraft/api-client';
import type { PaymentDto } from '@vcraft/contracts';
import { Badge, Button, buttonVariants } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useMoney } from '@/lib/use-money';

/** How often a pending payment is read again (ADR-0021: every 3 s, stop on a final state). */
export const PAYMENT_POLL_MS = 3_000;

/** VNPay and MoMo: the buyer pays on the provider's page and the server asks the provider for the result. */
export const isWallet = (payment: Pick<PaymentDto, 'method'>) =>
  payment.method === 'VNPAY' || payment.method === 'MOMO';

export const isFinalPayment = (status: PaymentDto['status']) => status !== 'PENDING';

const TONE: Record<PaymentDto['status'], 'celadon' | 'clay' | 'seal' | 'outline' | 'glaze'> = {
  PENDING: 'clay',
  PAID: 'celadon',
  FAILED: 'seal',
  EXPIRED: 'outline',
  CANCELLED: 'outline',
  REFUNDED: 'glaze',
};

export function PaymentStatusBadge({ status }: { status: PaymentDto['status'] }) {
  const t = useTranslations('payments.status');
  return (
    <Badge tone={TONE[status]} data-testid="payment-status">
      {t(status)}
    </Badge>
  );
}

/**
 * Reads a pending payment every few seconds and reports each fresh copy, until it leaves `PENDING`.
 * The poll is the live status: the server changes the payment only from a verified provider event.
 */
export function usePaymentPoll(
  client: PaymentClient | null,
  payment: PaymentDto | null | undefined,
  onUpdate: (payment: PaymentDto) => void,
) {
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const reference = payment && payment.status === 'PENDING' ? payment.referenceCode : null;
  useEffect(() => {
    if (!client || !reference) return;
    let active = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const fresh = await client.getPayment(reference);
        if (active && fresh.status !== 'PENDING') update.current(fresh);
      } catch {
        // A failed poll is retried at the next tick.
      }
    };
    const timer = window.setInterval(() => void tick(), PAYMENT_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [client, reference]);
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations('payments.bank');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => setCopied(true))
          .catch(() => {});
      }}
    >
      {copied ? t('copied') : t('copy')}
    </Button>
  );
}

/** True on touch-first devices (phones, tablets), where a wallet's app deeplink can actually open the app. */
function useCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    setCoarse(window.matchMedia('(pointer: coarse)').matches);
  }, []);
  return coarse;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <dt className="w-44 text-small text-ash">{label}</dt>
      <dd className="flex items-center gap-2 break-all font-medium">{children}</dd>
    </div>
  );
}

/** The compact facts of a payment: its code (to quote to the board), amount, method, kind and when it was paid. */
export function PaymentSummary({ payment }: { payment: PaymentDto }) {
  const t = useTranslations('payments');
  const format = useFormatter();
  const money = useMoney();
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
      <dt className="text-small text-ash">{t('result.code')}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="break-all font-medium font-mono" data-testid="payment-code">
          {payment.referenceCode}
        </span>
        <CopyButton value={payment.referenceCode} label={t('result.copyCode')} />
      </dd>
      <dt className="text-small text-ash">{t('result.amount')}</dt>
      <dd className="font-medium">{money(payment.amountVnd)}</dd>
      <dt className="text-small text-ash">{t('result.method')}</dt>
      <dd>{t(`method.${payment.method}`)}</dd>
      <dt className="text-small text-ash">{t('result.kind')}</dt>
      <dd>{t(`kind.${payment.kind}`)}</dd>
      {payment.paidAt ? (
        <>
          <dt className="text-small text-ash">{t('result.paidAt')}</dt>
          <dd>{format.dateTime(new Date(payment.paidAt), 'stamp')}</dd>
        </>
      ) : null}
    </dl>
  );
}

/** How to pay a pending payment: the bank panel with its QR, or the link to the wallet's page. */
export function PaymentCheckout({ payment }: { payment: PaymentDto }) {
  const bank = useTranslations('payments.bank');
  const money = useMoney();
  const checkout = payment.checkout;
  if (!checkout) return null;

  if (checkout.type === 'BANK_TRANSFER') {
    return (
      <section aria-labelledby={`bank-${payment.id}`} className="flex flex-col gap-4">
        <h3 id={`bank-${payment.id}`} className="text-h4">
          {bank('title')}
        </h3>
        <p className="text-ash">{bank('scan')}</p>
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {checkout.qrImageUrl ? (
            // biome-ignore lint/performance/noImgElement: a remote QR image of a payment; not optimisable.
            <img
              src={checkout.qrImageUrl}
              alt={bank('qrAlt')}
              width={220}
              height={220}
              className="h-[220px] w-[220px] rounded-card border border-ink/10 bg-white p-2"
            />
          ) : null}
          <dl className="flex flex-col gap-3" data-testid="bank-details">
            <Row label={bank('bank')}>{checkout.bankName}</Row>
            <Row label={bank('account')}>
              {checkout.accountNumber}
              <CopyButton value={checkout.accountNumber} />
            </Row>
            <Row label={bank('accountName')}>{checkout.accountName}</Row>
            <Row label={bank('amount')}>
              {money(payment.amountVnd)}
              <CopyButton value={String(payment.amountVnd)} />
            </Row>
            <Row label={bank('content')}>
              <span data-testid="transfer-content">{checkout.transferContent}</span>
              <CopyButton value={checkout.transferContent} />
            </Row>
          </dl>
        </div>
        <p className="text-small text-ash">{bank('contentHint')}</p>
      </section>
    );
  }

  return <RedirectCheckout payment={payment} url={checkout.url} deeplink={checkout.deeplink} />;
}

function RedirectCheckout({
  payment,
  url,
  deeplink,
}: {
  payment: PaymentDto;
  url: string;
  deeplink: string | null;
}) {
  const redirect = useTranslations('payments.redirect');
  const short = useTranslations('payments.methodShort');
  const coarse = useCoarsePointer();
  const method = short(payment.method);
  return (
    <section aria-labelledby={`redirect-${payment.id}`} className="flex flex-col gap-3">
      <h3 id={`redirect-${payment.id}`} className="text-h4">
        {redirect('title', { method })}
      </h3>
      <p className="text-ash">{redirect('text')}</p>
      <div className="flex flex-wrap gap-3">
        <a href={url} className={buttonVariants({ variant: 'primary' })}>
          {redirect('open', { method })}
        </a>
        {deeplink && coarse ? (
          <a href={deeplink} className={buttonVariants({ variant: 'secondary' })}>
            {redirect('app', { method })}
          </a>
        ) : null}
      </div>
    </section>
  );
}

/** The one-line state of a payment: waiting, paid, failed, expired, cancelled, refunded. */
export function PaymentLiveLine({ payment }: { payment: PaymentDto }) {
  const t = useTranslations('payments.live');
  const short = useTranslations('payments.methodShort');
  const format = useFormatter();
  const stamp = (iso: string) => format.dateTime(new Date(iso), 'stamp');
  switch (payment.status) {
    case 'PENDING':
      return (
        <p role="status" className="flex items-start gap-2.5 text-ash">
          <span
            aria-hidden="true"
            className="mt-[9px] size-2 shrink-0 rounded-full bg-clay motion-safe:animate-pulse"
          />
          <span>
            {isWallet(payment)
              ? t('waitingWallet', { method: short(payment.method) })
              : t('waiting')}{' '}
            {payment.expiresAt ? t('expiresAt', { time: stamp(payment.expiresAt) }) : ''}
          </span>
        </p>
      );
    case 'PAID':
      return (
        <p role="status" className="font-medium">
          {t('paid')} {payment.paidAt ? t('paidAt', { time: stamp(payment.paidAt) }) : ''}
        </p>
      );
    case 'FAILED':
      return <p role="status">{t('failed')}</p>;
    case 'EXPIRED':
      return <p role="status">{t('expired')}</p>;
    case 'CANCELLED':
      return <p role="status">{t('cancelled')}</p>;
    case 'REFUNDED':
      return (
        <p role="status">
          {t('refunded')}
          {payment.refundReason ? ` ${t('refundReason', { reason: payment.refundReason })}` : ''}
        </p>
      );
  }
}
