'use client';

import type { PriceHintDto } from '@vcraft/contracts';
import { Button, Card, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { AmountInWords } from '@/components/amount-in-words';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { notify } from '@/lib/notify';
import { endOfDay, endOfDayTime } from './rfq-form-model';

export interface ContributionFormValues {
  maxQuantity: number;
  unitPriceVnd: number;
  /** Ngày hoàn thành hộ hứa, tuyệt đối (ISO). */
  completionDate: string;
}

export interface ContributionFormProps {
  /** Mã yêu cầu chỉ để hiển thị. */
  rfqCode: string;
  quantity: number;
  unit: string;
  /** Hạn chào giá: ngày hoàn thành phải sau mốc này. */
  biddingClosesAt: string;
  requiredBy: string;
  /** Giá trị nháp khởi điểm (sửa đóng góp); không có thì Form bắt đầu trống. */
  initial?: Partial<ContributionFormValues>;
  /** Phiên bản đóng góp đang sửa (If-Match); có thì nút thành "Cập nhật". */
  version?: number;
  /** Đã rút: giữ lại dữ liệu và cho gửi lại trước hạn. */
  withdrawn?: boolean;
  /** Suggested unit price range (PLAN E9); not shown when absent or null. */
  priceHint?: PriceHintDto['hint'] | undefined;
  disabled?: boolean;
  /**
   * Gửi đề xuất tham gia. API caller truyền mutation ở đây (kèm token của phiên);
   * không truyền thì Form chỉ mô phỏng cục bộ và ghi nhãn rõ ràng.
   */
  onSubmit?: (values: ContributionFormValues) => Promise<void>;
  /** Rút đề xuất (chỉ khi có `version` và API caller). */
  onWithdraw?: () => Promise<void>;
}

type Field = 'max' | 'price' | 'date';

const FIELD_ORDER: readonly Field[] = ['max', 'price', 'date'];

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

const isoDate = (value: string) => {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Form Đề xuất tham gia (GH#10): hộ khai mức tối đa, đơn giá và ngày hoàn thành tuyệt đối của mình
 * cho một yêu cầu báo giá. Đơn giá và ngày là thông tin riêng giữa hộ và BQL — bên mua không thấy.
 * Không có callback thì Form chỉ mô phỏng cục bộ và ghi nhãn demo rõ ràng.
 */
export function ContributionForm({
  rfqCode,
  quantity,
  unit,
  biddingClosesAt,
  requiredBy,
  initial,
  version,
  withdrawn,
  priceHint,
  disabled = false,
  onSubmit,
  onWithdraw,
}: ContributionFormProps) {
  const t = useTranslations('contribution');
  const format = useFormatter();
  const formId = useId();
  const [maxQuantity, setMaxQuantity] = useState(
    initial?.maxQuantity !== undefined ? String(initial.maxQuantity) : '',
  );
  const [unitPrice, setUnitPrice] = useState(
    initial?.unitPriceVnd !== undefined ? String(initial.unitPriceVnd) : '',
  );
  const [completionDate, setCompletionDate] = useState(
    initial?.completionDate !== undefined ? initial.completionDate.slice(0, 10) : '',
  );
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const maxRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const locked = disabled || submit.kind === 'sending' || submit.kind === 'sent';
  const demo = onSubmit === undefined;

  const closingTime = isoDate(biddingClosesAt);
  const requiredTime = isoDate(requiredBy);

  /** One message per invalid field; an absent key means the field is fine. */
  const errors = (() => {
    const list: Partial<Record<Field, string>> = {};
    const max = maxQuantity.trim() === '' ? NaN : Number(maxQuantity);
    const price = unitPrice.trim() === '' ? NaN : Number(unitPrice);
    const completion = endOfDayTime(completionDate);
    if (!(Number.isSafeInteger(max) && max >= 1 && max <= 2_147_483_647))
      list.max = t('problem.max');
    if (!(Number.isSafeInteger(price) && price >= 1)) list.price = t('problem.price');
    if (completion === null) {
      list.date = t('problem.dateMissing');
    } else if (closingTime !== null && completion <= closingTime) {
      list.date = t('problem.dateBeforeClosing', {
        date: format.dateTime(new Date(biddingClosesAt), 'short'),
      });
    } else if (requiredTime !== null && completion > requiredTime) {
      list.date = t('problem.dateAfterRequired', {
        date: format.dateTime(new Date(requiredBy), 'short'),
      });
    }
    return list;
  })();

  const ready = Object.keys(errors).length === 0;
  // An error shows only once its field was left (touched) or a submit was attempted (GH#477).
  const shown = (field: Field) =>
    submitAttempted || touched[field] ? (errors[field] ?? null) : null;
  const touch = (field: Field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const errorId = (field: Field) => `${formId}-${field}-error`;

  const send = async () => {
    if (locked) return;
    if (!ready) {
      setSubmitAttempted(true);
      const refs = { max: maxRef, price: priceRef, date: dateRef };
      const first = FIELD_ORDER.find((field) => errors[field] !== undefined);
      if (first) refs[first].current?.focus();
      return;
    }
    if (!onSubmit) {
      setSubmit({ kind: 'sent' });
      return;
    }
    setSubmit({ kind: 'sending' });
    try {
      await onSubmit({
        maxQuantity: Number(maxQuantity),
        unitPriceVnd: Number(unitPrice),
        completionDate: endOfDay(completionDate).toISOString(),
      });
      setSubmit({ kind: 'sent' });
      notify.success(t(version === undefined ? 'sentToast' : 'updatedToast'));
    } catch (error) {
      setSubmit({
        kind: 'error',
        message: error instanceof Error ? error.message : t('sendFailed'),
      });
    }
  };

  const withdraw = async () => {
    if (!onWithdraw || locked) return;
    setSubmit({ kind: 'sending' });
    try {
      await onWithdraw();
      notify.success(t('withdrawnToast'));
    } catch (error) {
      setSubmit({
        kind: 'error',
        message: error instanceof Error ? error.message : t('sendFailed'),
      });
    }
  };

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-sans text-body font-semibold text-ink">
          {t('title', { code: rfqCode })}
        </h2>
        <p className="mt-1 text-small text-ash">
          {t('lead', {
            quantity: format.number(quantity),
            unit,
          })}
        </p>
      </div>

      {withdrawn ? (
        <p className="rounded-card border border-seal/40 p-3 text-small text-seal">
          {t('withdrawn')}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Errors sit outside the labels so they do not join the inputs' accessible names. */}
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1 text-small">
            <span className="text-ash">{t('maxQuantity', { unit })}</span>
            <input
              ref={maxRef}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={maxQuantity}
              disabled={locked}
              aria-invalid={shown('max') ? 'true' : undefined}
              aria-describedby={shown('max') ? errorId('max') : undefined}
              onBlur={() => touch('max')}
              onChange={(e) => {
                setMaxQuantity(e.currentTarget.value);
                setSubmit({ kind: 'idle' });
              }}
              className={cn(
                'h-10 rounded-input border bg-paper px-2 text-right tabular-nums',
                'border-ink/20',
              )}
            />
          </label>
          <FieldError id={errorId('max')} message={shown('max')} />
        </div>
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
              onChange={(e) => {
                setUnitPrice(e.currentTarget.value);
                setSubmit({ kind: 'idle' });
              }}
              className={cn(
                'h-10 rounded-input border bg-paper px-2 text-right tabular-nums',
                'border-ink/20',
              )}
            />
          </label>
          <FieldError id={errorId('price')} message={shown('price')} />
          <AmountInWords id={`${formId}-price-words`} value={unitPrice} />
          {priceHint ? <PriceHintNote hint={priceHint} /> : null}
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
              onChange={(e) => {
                setCompletionDate(e.currentTarget.value);
                setSubmit({ kind: 'idle' });
              }}
              className={cn('h-10 rounded-input border bg-paper px-2', 'border-ink/20')}
            />
          </label>
          <FieldError id={errorId('date')} message={shown('date')} />
        </div>
      </div>

      <p className="text-small text-ash">
        {closingTime !== null
          ? t('dateWindow', {
              closing: format.dateTime(new Date(biddingClosesAt), 'short'),
              required: format.dateTime(new Date(requiredBy), 'short'),
            })
          : null}
      </p>

      {submit.kind === 'error' ? (
        <p role="alert" className="text-small font-medium text-seal">
          {submit.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={locked} onClick={() => void send()}>
          {submit.kind === 'sending'
            ? t('sending')
            : submit.kind === 'sent'
              ? demo
                ? t('simulatedLabel')
                : version === undefined
                  ? t('sentRealLabel')
                  : t('updatedLabel')
              : version === undefined
                ? t('send')
                : t('update')}
        </Button>
        {version !== undefined && onWithdraw && !withdrawn ? (
          <Button variant="secondary" disabled={locked} onClick={() => setConfirmWithdraw(true)}>
            {t('withdraw')}
          </Button>
        ) : null}
      </div>

      {submit.kind === 'sent' ? (
        <p aria-live="polite" className="text-small text-ink/85">
          {demo ? t('simulatedNote') : t('sentNote')}
        </p>
      ) : null}

      <p className="text-[0.75rem] text-ash">{demo ? t('demoNote') : t('liveNote')}</p>
      <span id={`${formId}-hint`} className="sr-only">
        {t('privacyNote')}
      </span>
      <ConfirmDialog
        open={confirmWithdraw}
        tone="seal"
        title={t('withdrawTitle')}
        confirmLabel={t('withdraw')}
        cancelLabel={t('cancel')}
        onClose={() => setConfirmWithdraw(false)}
        onConfirm={() => {
          setConfirmWithdraw(false);
          void withdraw();
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

/** The price range hint and, in one line, what it is based on (never other households' offers). */
function PriceHintNote({ hint }: { hint: NonNullable<PriceHintDto['hint']> }) {
  const t = useTranslations('contribution.priceHint');
  const format = useFormatter();
  const range =
    hint.minVnd === hint.maxVnd
      ? format.number(hint.minVnd, 'vnd')
      : `${format.number(hint.minVnd, 'vnd')} – ${format.number(hint.maxVnd, 'vnd')}`;
  return (
    <p className="text-small text-ash">
      <span className="font-medium text-ink">{t('range', { range })}</span>{' '}
      {t(`basis.${hint.basis}`, { own: hint.ownSamples, catalog: hint.catalogSamples })}
    </p>
  );
}
