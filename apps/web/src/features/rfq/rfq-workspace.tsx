'use client';

import {
  type RfqContext,
  type RfqEvent,
  type RfqGuardCode,
  type RfqStatus,
  transition,
} from '@vcraft/domain';
import { Button, Card, Crackle, SealMark, Stepper } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import type { Bid, Rfq } from '@/lib/demo/data';
import { BidComparison } from './bid-comparison';
import { buyerEvents, rfqStepperModel } from './rfq-flow';

type Dialog = { kind: 'accept'; bid: Bid } | { kind: 'event'; event: RfqEvent } | null;

/** Mã lỗi domain, có lời nhắn riêng ở `rfq.error.*`. */
type ErrorCode = RfqGuardCode | 'INVALID_TRANSITION';

export interface RfqWorkspaceProps {
  rfq: Rfq;
  /** Khối tóm tắt dựng ở server, chèn giữa thanh trạng thái và bảng chào giá. */
  children: ReactNode;
}

/**
 * Phần tương tác của màn RFQ (Buyer): stepper, hành động hợp lệ, bảng so sánh, chốt chào giá.
 * Mọi chuyển trạng thái đi qua `transition` của `@vcraft/domain`, cùng máy trạng thái với backend (FR-RFQ-12).
 * Bản demo chỉ giữ kết quả trong trạng thái cục bộ; khi có API, thay `apply` bằng mutation.
 */
export function RfqWorkspace({ rfq, children }: RfqWorkspaceProps) {
  const t = useTranslations('rfq');
  const format = useFormatter();
  const [status, setStatus] = useState<RfqStatus>(rfq.status);
  const [acceptedBidId, setAcceptedBidId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  const events = buyerEvents(status);
  const pageEvents = events.filter((e) => e !== 'ACCEPT_BID');
  const canAccept = events.includes('ACCEPT_BID');
  const model = rfqStepperModel(status, rfq.bids.length > 0);

  const bids: Bid[] = rfq.bids.map((b) =>
    acceptedBidId
      ? { ...b, status: b.id === acceptedBidId ? 'ACCEPTED' : 'REJECTED' }
      : status === 'CANCELLED' || status === 'EXPIRED'
        ? { ...b, status: 'LAPSED' }
        : b,
  );

  const baseContext = (): RfqContext => ({
    actor: 'BUYER_OWNER',
    now: new Date(),
    emailVerified: true,
    biddingClosesAt: new Date(rfq.biddingClosesAt),
    requiredBy: new Date(rfq.requiredBy),
    quantity: rfq.quantity,
    allocationStatuses: [],
  });

  const closeDialog = () => {
    setDialog(null);
    setReason('');
    setErrorCode(null);
  };

  const applyEvent = (event: RfqEvent) => {
    const result = transition(status, event, { ...baseContext(), reason });
    if (!result.ok) {
      setErrorCode(result.error.code);
      return;
    }
    if (event === 'CANCEL') setCancelReason(reason.trim());
    setStatus(result.value);
    closeDialog();
  };

  const applyAccept = (bid: Bid) => {
    const result = transition(status, 'ACCEPT_BID', {
      ...baseContext(),
      bid: { status: bid.status, quantityOffered: bid.quantityOffered },
    });
    if (!result.ok) {
      setErrorCode(result.error.code);
      return;
    }
    setStatus(result.value);
    setAcceptedBidId(bid.id);
    closeDialog();
  };

  const accepted = bids.find((b) => b.id === acceptedBidId);
  const day = (iso: string) => format.dateTime(new Date(iso), 'short');

  return (
    <div className="flex flex-col gap-10">
      <Card className="p-5 md:p-6">
        <Stepper
          label={t('stepperLabel')}
          current={model.current}
          state={model.halted ? 'halted' : 'active'}
          steps={model.steps.map((step) => ({
            id: step,
            label: t(`status.${step}`),
            ...(step === 'DRAFT'
              ? { hint: day(rfq.createdAt) }
              : step === 'SENT'
                ? { hint: day(rfq.sentAt) }
                : {}),
          }))}
        />
      </Card>

      {/* Đóng ấn (BRAND §6.3 #2) khi chốt thành công. */}
      {status === 'ACCEPTED' && accepted ? (
        <section
          aria-live="polite"
          className="relative flex items-center gap-5 overflow-hidden rounded-card bg-surface p-6 shadow-warm"
        >
          <Crackle className="text-glaze" />
          <SealMark size={72} className="relative animate-stamp" />
          <div className="relative">
            <h2 className="text-h3 text-seal">{t('accepted.title')}</h2>
            <p className="mt-1 text-ink/85">{t('accepted.text', { bidder: accepted.bidder })}</p>
          </div>
        </section>
      ) : null}

      {model.halted ? (
        <section
          aria-live="polite"
          className="relative overflow-hidden rounded-card border border-seal/40 p-6"
        >
          <Crackle className="text-seal" opacity={0.2} />
          <h2 className="relative text-h3 text-seal">
            {status === 'CANCELLED' ? t('halted.cancelledTitle') : t('halted.expiredTitle')}
          </h2>
          <p className="relative mt-1 text-ink/85">
            {status === 'CANCELLED' && cancelReason
              ? t('halted.reason', { reason: cancelReason })
              : t('halted.text')}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="actions-title" className="flex flex-col gap-3">
        <h2 id="actions-title" className="font-sans text-body font-semibold text-ink">
          {t('actions.title')}
        </h2>
        {pageEvents.length > 0 || canAccept ? (
          <div className="flex flex-wrap items-center gap-3">
            {pageEvents.map((event) => (
              <Button
                key={event}
                variant={event === 'CANCEL' ? 'secondary' : 'primary'}
                onClick={() => setDialog({ kind: 'event', event })}
              >
                {t(`event.${event}`)}
              </Button>
            ))}
            {canAccept ? <p className="text-small text-ash">{t('actions.acceptInTable')}</p> : null}
          </div>
        ) : (
          <p className="text-small text-ash">{t('actions.none')}</p>
        )}
        <p className="text-[0.75rem] text-ash">{t('actions.demoNote')}</p>
      </section>

      {children}

      <section aria-labelledby="bids-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="bids-title">{t('bids.title')}</h2>
          <p className="text-small text-ash">{t('bids.count', { count: bids.length })}</p>
        </div>
        <BidComparison
          bids={bids}
          quantity={rfq.quantity}
          unit={rfq.unit}
          canAccept={canAccept}
          onAccept={(bid) => setDialog({ kind: 'accept', bid })}
        />
      </section>

      <ConfirmDialog
        open={dialog?.kind === 'accept'}
        tone="seal"
        title={t('acceptDialog.title', {
          bidder: dialog?.kind === 'accept' ? dialog.bid.bidder : '',
        })}
        confirmLabel={t('acceptDialog.confirm')}
        cancelLabel={t('acceptDialog.back')}
        onClose={closeDialog}
        onConfirm={() => dialog?.kind === 'accept' && applyAccept(dialog.bid)}
      >
        {dialog?.kind === 'accept' ? (
          <p className="text-ink/85">
            {t('acceptDialog.text', {
              quantity: format.number(dialog.bid.quantityOffered),
              unit: rfq.unit,
              price: format.number(dialog.bid.unitPrice, 'vnd'),
              total: format.number(dialog.bid.unitPrice * dialog.bid.quantityOffered, 'vnd'),
            })}
          </p>
        ) : null}
        {errorCode ? (
          <p role="alert" className="text-small text-seal">
            {t(`error.${errorCode}`)}
          </p>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'event'}
        title={dialog?.kind === 'event' ? t(`event.${dialog.event}`) : ''}
        confirmLabel={dialog?.kind === 'event' ? t(`event.${dialog.event}`) : ''}
        cancelLabel={t('dialog.back')}
        onClose={closeDialog}
        onConfirm={() => dialog?.kind === 'event' && applyEvent(dialog.event)}
      >
        {dialog?.kind === 'event' && dialog.event === 'CANCEL' ? (
          <label className="flex flex-col gap-2 text-small">
            <span className="text-ash">{t('dialog.reasonLabel')}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t('dialog.reasonPlaceholder')}
              className="rounded-input border border-ink/20 bg-paper p-3 text-body"
            />
          </label>
        ) : (
          <p className="text-ink/85">{t('dialog.confirmText')}</p>
        )}
        {errorCode ? (
          <p role="alert" className="text-small text-seal">
            {t(`error.${errorCode}`)}
          </p>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
