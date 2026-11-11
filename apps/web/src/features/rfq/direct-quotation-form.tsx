'use client';

import type { CreateDirectQuotationRequest, DirectQuotationDto } from '@vcraft/contracts';
import { Button, Card, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { AmountInWords } from '@/components/amount-in-words';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { notify } from '@/lib/notify';
import { useMoney } from '@/lib/use-money';
import { endOfDay, endOfDayTime } from './rfq-form-model';

export interface DirectQuotationFormProps {
  rfqCode: string;
  quantity: number;
  unit: string;
  /** The completion date must come after this deadline. */
  biddingClosesAt: string;
  requiredBy: string;
  /** The household's latest quotation on the request, if it has one. */
  quotation: DirectQuotationDto | null;
  disabled?: boolean;
  /** Sends a new quotation, or revises `quotation` when it is still waiting for the buyer. */
  onSubmit: (values: CreateDirectQuotationRequest) => Promise<void>;
  onWithdraw: () => Promise<void>;
}

type Field = 'price' | 'date';

const time = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * The "Gửi báo giá" form of an invited household on a request without coordination (FR-RFQ-04): one
 * unit price for the whole quantity, a completion date and a note. The buyer sees the price and compares.
 */
export function DirectQuotationForm({
  rfqCode,
  quantity,
  unit,
  biddingClosesAt,
  requiredBy,
  quotation,
  disabled = false,
  onSubmit,
  onWithdraw,
}: DirectQuotationFormProps) {
  const t = useTranslations('directQuotation');
  const format = useFormatter();
  const money = useMoney();
  const formId = useId();
  // A withdrawn, rejected or expired quotation is history: the form starts fresh for a new one. A legacy
  // quotation whose stored part lost its price or date is still this household's active bid (GH#445), so
  // it stays editable: sending repairs both terms instead of colliding with the one-active rule.
  const editing = quotation?.status === 'SUBMITTED' ? quotation : null;
  const [unitPrice, setUnitPrice] = useState(
    editing?.unitPriceVnd != null ? String(editing.unitPriceVnd) : '',
  );
  const [completionDate, setCompletionDate] = useState(editing?.completionDate?.slice(0, 10) ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const priceRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const decided = quotation?.status === 'ACCEPTED' || quotation?.status === 'REJECTED';
  const locked = disabled || decided || state === 'sending';

  const closing = time(biddingClosesAt);
  const required = time(requiredBy);
  const price = unitPrice.trim() === '' ? Number.NaN : Number(unitPrice);
  const priceValid = Number.isSafeInteger(price) && price >= 1;
  const errors: Partial<Record<Field, string>> = {};
  if (!priceValid) errors.price = t('problem.price');
  const completion = endOfDayTime(completionDate);
  if (completion === null) errors.date = t('problem.dateMissing');
  else if (closing !== null && completion <= closing)
    errors.date = t('problem.dateBeforeClosing', {
      date: format.dateTime(new Date(biddingClosesAt), 'short'),
    });
  else if (required !== null && completion > required)
    errors.date = t('problem.dateAfterRequired', {
      date: format.dateTime(new Date(requiredBy), 'short'),
    });
  const ready = Object.keys(errors).length === 0;
  // An error shows only once its field was left (touched) or a submit was attempted (GH#477).
  const shown = (field: Field) =>
    submitAttempted || touched[field] ? (errors[field] ?? null) : null;
  const touch = (field: Field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const errorId = (field: Field) => `${formId}-${field}-error`;

  const run = async (action: () => Promise<void>, toast: string) => {
    setState('sending');
    try {
      await action();
      setState('idle');
      notify.success(toast);
    } catch {
      setState('error');
    }
  };

  const send = () => {
    if (locked) return;
    if (!ready) {
      setSubmitAttempted(true);
      (errors.price ? priceRef : dateRef).current?.focus();
      return;
    }
    void run(
      () =>
        onSubmit({
          unitPriceVnd: price,
          completionDate: endOfDay(completionDate).toISOString(),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      t(editing ? 'updatedToast' : 'sentToast'),
    );
  };

  const status = quotation
    ? quotation.status === 'SUBMITTED'
      ? quotation.unitPriceVnd !== null && quotation.completionDate !== null
        ? t('active', {
            price: money(quotation.unitPriceVnd),
            unit,
            total: money(quotation.totalVnd),
          })
        : t('missingTerms', { total: money(quotation.totalVnd) })
      : quotation.status === 'ACCEPTED'
        ? t('accepted')
        : quotation.status === 'REJECTED'
          ? t('rejected')
          : quotation.status === 'LAPSED'
            ? t('lapsed')
            : t('withdrawn')
    : null;

  const inputClass = 'h-10 rounded-input border border-ink/20 bg-paper px-2';
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-sans text-body font-semibold text-ink">
          {t('title', { code: rfqCode })}
        </h2>
        <p className="mt-1 text-small text-ash">
          {t('lead', { quantity: format.number(quantity), unit })}
        </p>
      </div>

      {status ? (
        <p role="status" className="rounded-card border border-ink/15 p-3 text-small">
          {status}
        </p>
      ) : null}

      {decided ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1 text-small">
                <span className="text-ash">{t('unitPrice')}</span>
                <input
                  ref={priceRef}
                  type="number"
                  min={1}
                  step={1000}
                  inputMode="numeric"
                  value={unitPrice}
                  disabled={locked}
                  aria-invalid={shown('price') ? 'true' : undefined}
                  aria-describedby={
                    shown('price')
                      ? `${errorId('price')} ${formId}-price-words`
                      : `${formId}-price-words`
                  }
                  onBlur={() => touch('price')}
                  onChange={(event) => {
                    setUnitPrice(event.currentTarget.value);
                    setState('idle');
                  }}
                  className={cn(inputClass, 'text-right tabular-nums')}
                />
              </label>
              <FieldError id={errorId('price')} message={shown('price')} />
              <AmountInWords id={`${formId}-price-words`} value={unitPrice} />
              {priceValid ? (
                <p className="text-small text-ink">
                  {t('total', {
                    quantity: format.number(quantity),
                    unit,
                    total: money(price * quantity),
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1">
              <label className="flex flex-col gap-1 text-small">
                <span className="text-ash">{t('completionDate')}</span>
                <input
                  ref={dateRef}
                  type="date"
                  value={completionDate}
                  disabled={locked}
                  aria-invalid={shown('date') ? 'true' : undefined}
                  aria-describedby={shown('date') ? errorId('date') : undefined}
                  onBlur={() => touch('date')}
                  onChange={(event) => {
                    setCompletionDate(event.currentTarget.value);
                    setState('idle');
                  }}
                  className={inputClass}
                />
              </label>
              <FieldError id={errorId('date')} message={shown('date')} />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-small">
            <span className="text-ash">{t('note')}</span>
            <textarea
              value={note}
              rows={3}
              maxLength={500}
              disabled={locked}
              onChange={(event) => {
                setNote(event.currentTarget.value);
                setState('idle');
              }}
              className="rounded-input border border-ink/20 bg-paper p-2 text-body"
            />
          </label>
          {closing !== null ? (
            <p className="text-small text-ash">
              {t('dateWindow', {
                closing: format.dateTime(new Date(biddingClosesAt), 'short'),
                required: format.dateTime(new Date(requiredBy), 'short'),
              })}
            </p>
          ) : null}

          {state === 'error' ? (
            <p role="alert" className="text-small font-medium text-seal">
              {t('sendFailed')}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={locked} onClick={send}>
              {state === 'sending' ? t('sending') : t(editing ? 'update' : 'send')}
            </Button>
            {editing ? (
              <Button
                variant="secondary"
                disabled={locked}
                onClick={() => setConfirmWithdraw(true)}
              >
                {t('withdraw')}
              </Button>
            ) : null}
          </div>

          <p className="text-[0.75rem] text-ash">{t('visibleToBuyer')}</p>
        </>
      )}

      <ConfirmDialog
        open={confirmWithdraw}
        tone="seal"
        title={t('withdrawTitle')}
        confirmLabel={t('withdraw')}
        cancelLabel={t('cancel')}
        onClose={() => setConfirmWithdraw(false)}
        onConfirm={() => {
          setConfirmWithdraw(false);
          void run(onWithdraw, t('withdrawnToast'));
        }}
      >
        <p className="text-ash">{t('withdrawText')}</p>
      </ConfirmDialog>
    </Card>
  );
}

/** The message of one invalid field, right under its input; renders nothing while the field is fine. */
function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} className="text-small font-medium text-seal">
      {message}
    </p>
  );
}
