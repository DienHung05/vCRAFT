'use client';

import type { PaymentClient } from '@vcraft/api-client';
import type { PaymentDto } from '@vcraft/contracts';
import { Badge, Button, buttonVariants } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useMoney } from '@/lib/use-money';

/** How often a pending payment is read again (ADR-0021: every 3 s, stop on a final state). */
export const PAYMENT_POLL_MS = 3_000;

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

/** A paid payment of a cancelled order: the money is owed back until it is marked refunded (GH#417). */
export function RefundDueBadge({
  payment,
}: {
  payment: Pick<PaymentDto, 'status' | 'refundDueAt'>;
}) {
  const t = useTranslations('payments');
  if (payment.status !== 'PAID' || !payment.refundDueAt) return null;
  return (
    <Badge tone="seal" data-testid="payment-refund-due">
      {t('refundDue')}
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

function CopyButton({ value }: { value: string }) {
  const t = useTranslations('payments.bank');
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <dt className="w-44 text-small text-ash">{label}</dt>
      <dd className="flex items-center gap-2 break-all font-medium">{children}</dd>
    </div>
  );
}

/** How to pay a pending payment: the bank panel with its QR, or the link to the wallet's page. */
export function PaymentCheckout({ payment }: { payment: PaymentDto }) {
  const bank = useTranslations('payments.bank');
  const redirect = useTranslations('payments.redirect');
  const method = useTranslations('payments.method');
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

  return (
    <section aria-labelledby={`redirect-${payment.id}`} className="flex flex-col gap-3">
      <h3 id={`redirect-${payment.id}`} className="text-h4">
        {redirect('title', { method: method(payment.method) })}
      </h3>
      <p className="text-ash">{redirect('text')}</p>
      <div className="flex flex-wrap gap-3">
        <a href={checkout.url} className={buttonVariants({ variant: 'primary' })}>
          {redirect('open')}
        </a>
        {checkout.deeplink ? (
          <a href={checkout.deeplink} className={buttonVariants({ variant: 'secondary' })}>
            {redirect('app')}
          </a>
        ) : null}
      </div>
    </section>
  );
}

/** The one-line state of a payment: waiting, paid, failed, expired, cancelled, refunded. */
export function PaymentLiveLine({ payment }: { payment: PaymentDto }) {
  const t = useTranslations('payments.live');
  const format = useFormatter();
  const stamp = (iso: string) => format.dateTime(new Date(iso), 'stamp');
  switch (payment.status) {
    case 'PENDING':
      return (
        <p role="status" className="text-ash">
          {t('waiting')}{' '}
          {payment.expiresAt ? t('expiresAt', { time: stamp(payment.expiresAt) }) : ''}
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
